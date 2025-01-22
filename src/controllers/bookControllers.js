const fetch = require("node-fetch");
const pool = require("../config/database");
const { response } = require("express");

async function getBookInfo(isbn) {
  try {
    console.time('getBookInfo Execution Time');  // Mulai menghitung waktu eksekusi

    // Pastikan ISBN adalah string
    if (!isbn || typeof isbn !== 'string') {
      console.timeEnd('getBookInfo Execution Time');  // Akhiri waktu eksekusi
      return { error: "Invalid ISBN format" };
    }

    console.log("ISBN Parameter: ", isbn);  // Menampilkan nilai ISBN

    // Ambil informasi buku berdasarkan ISBN dari database
    console.time('Database Query Time');
    const [rows] = await pool.query(
      "SELECT isbn, id_perpus FROM buku WHERE isbn = ? LIMIT 1", 
      [isbn]
    );
    console.timeEnd('Database Query Time');  // Log waktu query database

    if (rows.length === 0) {
      console.timeEnd('getBookInfo Execution Time');
      return { error: 'No book found with this ISBN' }; // Jika tidak ada buku yang ditemukan dengan ISBN
    }

    const idPerpus = rows.map((row) => row.id_perpus);

    // URL untuk mengambil informasi buku dari Open Library
    console.time('Open Library API Call');
    const keysUrls = rows.map((row) => `https://openlibrary.org/isbn/${row.isbn}.json`);

    const keyResponses = await Promise.all(
      keysUrls.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Error fetching data from Open Library: ${response.status}`);
          }
          return response.json();
        } catch (error) {
          console.error("Error fetching book info from Open Library:", error);
          return { error: `Error fetching data from Open Library: ${error.message}` };
        }
      })
    );
    console.timeEnd('Open Library API Call');  // Log waktu API call

    // Filter responses untuk menghindari nilai null
    const validResponses = keyResponses.filter(response => response !== null);

    if (validResponses.length === 0) {
      console.timeEnd('getBookInfo Execution Time');
      return { error: 'No valid data found from Open Library' };
    }

    const extractedKeys = validResponses.map((response) => response.works);

    const descriptionResponses = await Promise.all(
      extractedKeys.map(async (works) => {
        if (works && works.length > 0) {
          const keys = works.map((work) => work.key);
          const response = await fetch(`https://openlibrary.org${keys[0]}.json`);
          return response.json();
        } else {
          return { error: 'No works found for this ISBN' };
        }
      })
    );

    const extractedDescriptions = descriptionResponses.map((response) => ({
      subjects: response?.subjects || "No subjects available",
      description: response?.description || "No description available",
      id_perpus: idPerpus || null,
    }));

    console.timeEnd('getBookInfo Execution Time');  // Akhiri waktu eksekusi
    return extractedDescriptions;
  } catch (error) {
    console.error("Error:", error);
    return { error: 'Error processing the request' };
  }
}

//getbooks
async function getBooks(req, res) {
  console.time('getBooks Execution Time'); // Mulai waktu eksekusi untuk seluruh fungsi

  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;

  try {
    console.time('Database Query Time');
    const start = (page - 1) * size;
    const [rows] = await pool.query(
      "SELECT title, author, isbn, publication_year, publisher, id_perpus FROM buku LIMIT ?, ?",
      [start, size]
    );
    console.timeEnd('Database Query Time');  // Log waktu query database

    // Fetching cover URLs and other details asynchronously
    console.time('Cover URLs Fetch Time');
    const coverUrlsPromises = rows.map(async (row) => {
      const isbn = row.isbn;
      const coverUrl = `http://covers.openlibrary.org/b/isbn/${isbn}-S.jpg`;
      return coverUrl;
    });
    const coverUrls = await Promise.all(coverUrlsPromises);
    console.timeEnd('Cover URLs Fetch Time');

    // Fetching book info and combining results
    console.time('Book Info Fetch Time');
    const bookInfoPromises = rows.map(async (book, index) => {
      const bookInfo = await getBookInfo(book.isbn);
      const subjects = bookInfo.map((item) => item.subjects).flat() || [];
      const description = bookInfo.map((item) => item.description?.value).flat() || [];
      return {
        ...book,
        coverUrl: coverUrls[index],
        subject: subjects,
        description: description,
      };
    });
    const booksWithCovers = await Promise.all(bookInfoPromises);
    console.timeEnd('Book Info Fetch Time');

    console.timeEnd('getBooks Execution Time'); // Akhiri waktu eksekusi
    return res.status(200).json({ status: "success", data: booksWithCovers });
  } catch (error) {
    console.timeEnd('getBooks Execution Time');
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getBook(req, res) {
  const searchTerm = req.params.any;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;

  if (searchTerm !== null) {
    try {
      const columns = ["title", "author", "publisher", "isbn"];
      const conditions = columns.map(
        (column) =>
          `${column} COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%'`
      );

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" OR ")}` : "";

      const start = (page - 1) * size;

      const query = `SELECT title, author, isbn, publication_year, publisher, id_perpus,
                      CASE
                        WHEN title COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%' THEN 'title'
                        WHEN author COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%' THEN 'author'
                        WHEN publisher COLLATE utf8mb4_general_ci LIKE '%${searchTerm}%' THEN 'publisher'
                        WHEN isbn LIKE '%${searchTerm}%' THEN 'isbn'
                        ELSE NULL
                      END AS matched_column
                    FROM buku ${whereClause} LIMIT ?, ?`;

      const [rows] = await pool.query(query, [start, size]);

      // Update the access count for each book
      for (const row of rows) {
        const isbn = row.isbn;
        await pool.query(
          "UPDATE buku SET access_count = access_count + 1 WHERE isbn = ?",
          [isbn]
        );
      }

      // Fetch cover URLs and other information
      const coverUrlsPromises = rows.map(async (row) => {
        const isbn = row.isbn;
        const coverUrl = `http://covers.openlibrary.org/b/isbn/${isbn}-S.jpg`;
        return coverUrl;
      });

      const coverUrls = await Promise.all(coverUrlsPromises);

      const bookInfoPromises = rows.map(async (book, index) => {
        const bookInfo = await getBookInfo(book.isbn);
        const subjects =
          (bookInfo.map((item) => item.subjects).flat() || []);
        const description =
          (bookInfo.map((item) => item.description?.value).flat() || []);
        return {
          ...book,
          coverUrl: coverUrls[index],
          subject: subjects,
          description: description,
        };
      });

      const booksWithCovers = await Promise.all(bookInfoPromises);
      return res.status(200).json({ status: "success", data: booksWithCovers });
    } catch (error) {
      return res.status(500).json({ status: "fail", data: error });
    }
  } else {
    return res
      .status(404)
      .json({ status: "fail", message: "Buku tidak ditemukan" });
  }
}

async function getTopBooks(req, res) {
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;

  try {
    const start = (page - 1) * size;
    const [rows] = await pool.query(
      `SELECT title, author, isbn, publication_year, publisher, access_count
       FROM buku ORDER BY access_count DESC LIMIT ?, ?`,
      [start, size]
    );

    const coverUrlsPromises = rows.map(async (row) => {
      const isbn = row.isbn;
      const coverUrl = `http://covers.openlibrary.org/b/isbn/${isbn}-S.jpg`;
      return coverUrl;
    });

    const coverUrls = await Promise.all(coverUrlsPromises);

    const bookInfoPromises = rows.map(async (book, index) => {
      const bookInfo = await getBookInfo(book.isbn);
      const subjects =
        (bookInfo.map((item) => item.subjects).flat() || []);
      const description =
        (bookInfo.map((item) => item.description?.value).flat() || []);
      return {
        ...book,
        coverUrl: coverUrls[index],
        subject: subjects,
        description: description,
      };
    });

    const booksWithCovers = await Promise.all(bookInfoPromises);
    return res.status(200).json({ status: "success", data: booksWithCovers });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getBooksSubject(req, res) {
  const subject = req.params.subject;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;

  try {
    const subjectApiUrl = `http://openlibrary.org/subjects/${subject}.json`;
    const subjectApiResponse = await fetch(subjectApiUrl);
    const subjectApiData = await subjectApiResponse.json();

    if (!subjectApiData.works || subjectApiData.works.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: "No books found for the specified subject",
      });
    }

    const titleWithSubject = subjectApiData.works.map((work) => work.title);
    const start = (page - 1) * size;

    const placeholders = titleWithSubject.map(() => "?").join(", ");
    const [rows] = await pool.query(
      `SELECT DISTINCT title, author, isbn, publication_year, publisher, id_perpus FROM buku WHERE title COLLATE utf8mb4_general_ci IN (${placeholders}) LIMIT ?, ?`,
      [...titleWithSubject, start, size]
    );

    if (rows.length > 0) {
      res.status(200).json({
        status: "success",
        message: "Matches found in the database",
        data: rows,
      });
    } else {
      res.status(404).json({
        status: "fail",
        message: "No matches found in the database",
      });
    }
  } catch (error) {
    console.error("Error checking result with database:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
}

async function getTrendingBooks(req, res) {
  const trending = req.params.any || "daily";
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;

  try {
    const booksUrl = `https://openlibrary.org/trending/${trending}.json`;
    const booksUrlResponse = await fetch(booksUrl);
    const booksUrlData = await booksUrlResponse.json();

    const booksTitles = booksUrlData.works.map((work) => work.title);

    const titlePlaceholders = Array(booksTitles.length).fill("?").join(", ");

    const start = (page - 1) * size;
    const [rows] = await pool.query(
      `SELECT title, author, isbn, publication_year, publisher, id_perpus FROM buku WHERE title COLLATE utf8mb4_general_ci IN (${titlePlaceholders}) LIMIT ?, ?`,
      [...booksTitles, start, size]
    );

    const coverUrlsPromises = rows.map(async (row) => {
      const isbn = row.isbn;
      const coverUrl = `http://covers.openlibrary.org/b/isbn/${isbn}-S.jpg`;
      return coverUrl;
    });

    const coverUrls = await Promise.all(coverUrlsPromises);

    const bookInfoPromises = rows.map(async (book, index) => {
      const subjects =
        (await getBookInfo(book.isbn)).map((item) => item.subjects).flat() ||
        [];
      const description =
        (await getBookInfo(book.isbn))
          .map((item) => item.description?.value)
          .flat() || [];
      return {
        ...book,
        coverUrl: coverUrls[index],
        subject: subjects,
        description: description,
      };
    });

    const booksWithCovers = await Promise.all(bookInfoPromises);

    return res.status(200).json({ status: "success", data: booksWithCovers });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getLocation(req, res) {
  const latitude = req.query.latitude;
  const longitude = req.query.longitude;

  try {
    const locationRecommendation = await fetch(
      `http://127.0.0.1:5000/library_recommendation?latitude=${latitude}&longitude=${longitude}`
    );
    const locationData = await locationRecommendation.json();

    return res.status(200).json({ status: "success", data: locationData });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getLibraries(req, res) {
  try {
    const [rows] = await pool.query("SELECT * FROM perpustakaan");

    return res.status(200).json({ status: "success", data: rows });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

async function getLibraryBooks(req, res) {
  const id_perpus = req.params.id_perpus;
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 20;

  try {
    const start = (page - 1) * size;
    const [rows] = await pool.query(
      "SELECT title, author, isbn, publication_year, publisher, id_perpus FROM buku WHERE id_perpus LIKE ? LIMIT ?, ?",
      [`%${id_perpus}%`, start, size]
    );

    return res.status(200).json({ status: "success", data: rows });
  } catch (error) {
    return res.status(500).json({ status: "fail", data: error });
  }
}

module.exports = {
  getBooks,
  getBook,
  getTopBooks,
  getBookInfo,
  getBooksSubject,
  getTrendingBooks,
  getLocation,
  getLibraries,
  getLibraryBooks,
};
