const express = require("express");

const router = express.Router();

const {
  addCoupon,
  updateCoupon,
  getSingleCoupon,
  getAllCoupons,
  changeCouponVisible,
  changeCouponStatus,
  deleteCoupon,
  getCouponItems,
} = require("../controllers/couponController");

const { authMiddleware } = require("../middlewares/authMiddleware");
const { adminMiddleware } = require("../middlewares/adminMiddleware");

router.post("/add",authMiddleware,adminMiddleware, addCoupon);

router.put("/update/:id",authMiddleware,adminMiddleware, updateCoupon);

router.get("/all",authMiddleware,adminMiddleware, getAllCoupons);

router.get("/items", authMiddleware, adminMiddleware, getCouponItems);

router.get("/:id",authMiddleware,adminMiddleware, getSingleCoupon);

router.patch("/visibility/:id",authMiddleware,adminMiddleware, changeCouponVisible);

router.patch("/status/:id",authMiddleware,adminMiddleware, changeCouponStatus);

router.delete("/delete/:id",authMiddleware,adminMiddleware, deleteCoupon);

module.exports = router;
