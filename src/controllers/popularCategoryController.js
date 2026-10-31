const mongoose = require("mongoose");
const PopularCategory = require("../models/popularCategory");
require("../models/course"); // registers the model that `courses` populates from

// Valid, de-duplicated ObjectIds in the order given
const cleanIds = (ids) => {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  return ids.filter((id) => {
    const key = String(id);
    if (!mongoose.Types.ObjectId.isValid(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const Course = mongoose.model("course");
const TABS = { isAll: { $ne: true } }; // every query below is about tabs unless it says otherwise

const populated = (query) =>
  query.populate({ path: "courses", select: "m_course_title m_course_status" });

// What All Programs shows before it has ever been saved: courses picked in a
// tab first (in tab order), then every other active course.
const defaultAllCourses = async (tabs) => {
  const active = await Course.find({ m_course_status: 1 })
    .select("m_course_title m_course_status")
    .sort({ m_course_order: 1, _id: -1 });
  const rank = new Map();
  tabs.forEach((t) => t.courses.filter(Boolean).forEach((x) => {
    if (!rank.has(String(x._id))) rank.set(String(x._id), rank.size);
  }));
  const curated = [...rank.keys()]
    .map((id) => active.find((c) => String(c._id) === id))
    .filter(Boolean);
  return [...curated, ...active.filter((c) => !rank.has(String(c._id)))];
};

// Called when a course is created: it goes to the top of All Programs.
// A course the admin later removes from the list stays removed.
const addToAllPrograms = async (courseId) => {
  const id = String(courseId);
  const saved = await PopularCategory.findOne({ isAll: true });
  const current = saved
    ? saved.courses.map(String)
    : (await defaultAllCourses(await populated(PopularCategory.find(TABS).sort({ order: 1, _id: 1 })))).map((c) => String(c._id));
  await PopularCategory.findOneAndUpdate(
    { isAll: true },
    { $set: { title: "All Programs", status: 1, courses: [id, ...current.filter((x) => x !== id)] } },
    { upsert: true, setDefaultsOnInsert: true },
  );
};

// ADMIN: tabs in order with their courses, plus the 'All Programs' list.
// Until All Programs has been saved once, it defaults to what the website
// showed before: curated courses first, then every other active course.
const getAll = async (req, res) => {
  try {
    const data = await populated(
      PopularCategory.find(TABS).sort({ order: 1, _id: 1 }),
    );

    const saved = await populated(PopularCategory.findOne({ isAll: true }));
    let all;
    if (saved) {
      all = { configured: true, courses: saved.courses.filter(Boolean) };
    } else {
      all = { configured: false, courses: await defaultAllCourses(data) };
    }

    res.json({ status: true, data, all });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const title = (req.body.title || "").trim();
    if (!title) {
      return res.status(400).json({ status: false, message: "Title is required" });
    }

    const last = await PopularCategory.findOne(TABS).sort({ order: -1 });
    const created = await PopularCategory.create({
      title,
      order: last ? last.order + 1 : 0,
      status: req.body.status !== undefined ? Number(req.body.status) : 1,
      courses: cleanIds(req.body.courses),
    });

    res.status(201).json({
      status: true,
      message: "Category created",
      data: await populated(PopularCategory.findById(created._id)),
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// Partial update: title, status and/or courses (the full ordered list)
const update = async (req, res) => {
  try {
    const category = await PopularCategory.findOne({ _id: req.params.id, ...TABS });
    if (!category) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) {
        return res.status(400).json({ status: false, message: "Title is required" });
      }
      category.title = title;
    }
    if (req.body.status !== undefined) category.status = Number(req.body.status);
    if (req.body.courses !== undefined) category.courses = cleanIds(req.body.courses);

    await category.save();

    res.json({
      status: true,
      message: "Category updated",
      data: await populated(PopularCategory.findById(category._id)),
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const remove = async (req, res) => {
  try {
    const deleted = await PopularCategory.findOneAndDelete({ _id: req.params.id, ...TABS });
    if (!deleted) {
      return res.status(404).json({ status: false, message: "Category not found" });
    }
    res.json({ status: true, message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// body: { courses: [courseId, ...] } the full ordered 'All Programs' list
const saveAll = async (req, res) => {
  try {
    await PopularCategory.findOneAndUpdate(
      { isAll: true },
      { $set: { title: "All Programs", status: 1, courses: cleanIds(req.body.courses) } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    const saved = await populated(PopularCategory.findOne({ isAll: true }));
    res.json({
      status: true,
      message: "All Programs saved",
      all: { configured: true, courses: saved.courses.filter(Boolean) },
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// body: { ids: [categoryId, ...] } in the new display order
const reorder = async (req, res) => {
  try {
    const ids = cleanIds(req.body.ids);
    await PopularCategory.bulkWrite(
      ids.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
      })),
    );
    res.json({ status: true, message: "Order saved" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

// PUBLIC: active categories in order; courses are ids in display order.
// The website maps them onto the course list it already loads.
const publicGetAll = async (req, res) => {
  try {
    const categories = await PopularCategory.find({ status: 1, ...TABS })
      .sort({ order: 1, _id: 1 })
      .lean();
    const all = await PopularCategory.findOne({ isAll: true }).lean();
    res.json({
      status: true,
      // null until saved in the admin: the website then lists every active course
      all: all ? (all.courses || []).map(String) : null,
      data: categories.map((c) => ({
        _id: c._id,
        title: c.title,
        courses: (c.courses || []).map(String),
      })),
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = { addToAllPrograms, getAll, create, update, remove, reorder, saveAll, publicGetAll };
