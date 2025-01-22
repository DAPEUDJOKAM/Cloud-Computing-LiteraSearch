const express = require("express");
const router = express.Router();
const bookControllers = require("../controllers/bookControllers");

router.get("/all", bookControllers.getBooks);
router.get("/search/:any", bookControllers.getBook);
router.get("/popular", bookControllers.getTopBooks);
/* router.get("/covers/:isbn", bookControllers.getBookCovers); */
/* router.get("/info/:isbn", bookControllers.getBookInfo); */
router.get("/info/:isbn", bookControllers.getBookInfo);
router.get("/subject/:subject", bookControllers.getBooksSubject);
router.get("/trending/:any", bookControllers.getTrendingBooks);
router.get("/location", bookControllers.getLocation);
router.get("/libraries", bookControllers.getLibraries);
router.get("/library/:id_perpus", bookControllers.getLibraryBooks);

module.exports = router;
