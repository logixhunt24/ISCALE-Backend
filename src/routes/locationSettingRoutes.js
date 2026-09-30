const express = require("express");

const router = express.Router();

const locationController = require("../controllers/locationSettingController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");

// ======================================================
// COUNTRY ROUTES
// ======================================================

// ADD COUNTRY
router.post(
  "/country/add",
  authMiddleware,
  adminMiddleware,
  locationController.addCountry,
);

// UPDATE COUNTRY
router.put(
  "/country/update/:id",
  authMiddleware,
  adminMiddleware,
  locationController.updateCountry,
);

// GET ALL COUNTRIES
router.get(
  "/country/all",
  authMiddleware,
  adminMiddleware,
  locationController.getAllCountry,
);

// GET SINGLE COUNTRY
router.get(
  "/country/single/:id",
  authMiddleware,
  adminMiddleware,
  locationController.getSingleCountry,
);

// COUNTRY DROPDOWN
router.get(
  "/country/dropdown",
  authMiddleware,
  adminMiddleware,
  locationController.getCountryDropdown,
);

router.get("/public/country/dropdown", locationController.getCountryDropdown);

// DELETE COUNTRY
router.delete(
  "/country/delete/:id",
  authMiddleware,
  adminMiddleware,
  locationController.deleteCountry,
);

// ======================================================
// STATE ROUTES
// ======================================================

// ADD STATE
router.post(
  "/state/add",
  authMiddleware,
  adminMiddleware,
  locationController.addState,
);

// UPDATE STATE
router.put(
  "/state/update/:id",
  authMiddleware,
  adminMiddleware,
  locationController.updateState,
);

// GET ALL STATES
router.get(
  "/state/all",
  authMiddleware,
  adminMiddleware,
  locationController.getAllState,
);

// GET SINGLE STATE
router.get(
  "/state/single/:id",
  authMiddleware,
  adminMiddleware,
  locationController.getSingleState,
);

// STATE DROPDOWN
router.get(
  "/state/dropdown",
  authMiddleware,
  adminMiddleware,
  locationController.getStateDropdown,
);

router.get("/public/state/dropdown", locationController.getStateDropdown);

// DELETE STATE
router.delete(
  "/state/delete/:id",
  authMiddleware,
  adminMiddleware,
  locationController.deleteState,
);

// ======================================================
// CITY ROUTES
// ======================================================

// ADD CITY
router.post(
  "/city/add",
  authMiddleware,
  adminMiddleware,
  locationController.addCity,
);

// UPDATE CITY
router.put(
  "/city/update/:id",
  authMiddleware,
  adminMiddleware,
  locationController.updateCity,
);

// GET ALL CITY
router.get(
  "/city/all",
  authMiddleware,
  adminMiddleware,
  locationController.getAllCity,
);

// GET SINGLE CITY
router.get(
  "/city/single/:id",
  authMiddleware,
  adminMiddleware,
  locationController.getSingleCity,
);

// CITY DROPDOWN
router.get(
  "/city/dropdown",
  authMiddleware,
  adminMiddleware,
  locationController.getCityDropdown,
);

router.get("/public/city/dropdown", locationController.getCityDropdown);
// Android POSTs with state_id in form body
router.post("/public/city/dropdown", locationController.getCityDropdown);

// DELETE CITY
router.delete(
  "/city/delete/:id",
  authMiddleware,
  adminMiddleware,
  locationController.deleteCity,
);

module.exports = router;
