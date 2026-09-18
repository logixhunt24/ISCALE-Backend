const Job = require("../models/company_requirement");
const JobApplication = require("../models/company_requirement_application");
const fs = require("fs");

const addJob = async (req, res) => {
  try {
    const jobData = {
      job_title: req.body.job_title,

      company_name: req.body.company_name,

      company_logo: req.files?.company_logo?.[0]?.path || req.body.company_logo,

      last_date_to_apply: req.body.last_date_to_apply || null,

      recruiter_mobile_no: req.body.recruiter_mobile_no || null,

      recruiter_whatsapp_no: req.body.recruiter_whatsapp_no || null,

      recruiter_date: req.body.recruiter_date || null,

      recruiter_expire_date: req.body.recruiter_expire_date || null,

      job_locations: req.body.location
        ? Array.isArray(req.body.location)
          ? req.body.location
          : [req.body.location]
        : [],

      salary: {
        min: Number(req.body.salary_from) || 0,
        max: Number(req.body.salary_to) || 0,
      },

      salary_type: req.body.salary_type || "PM",

      experience: req.body.experience || null,

      job_description: req.body.job_description,

      application_link: req.body.apply_link,

      // company_social_links: {
      //   linkedin: req.body.social_links?.linkedin,
      //   website: req.body.social_links?.website,
      //   twitter: req.body.social_links?.twitter,
      //   instagram: req.body.social_links?.instagram,
      // },

      company_social_links: {
        linkedin: req.body.linkedin || null,
        website: req.body.website || null,
        twitter: req.body.twitter || null,
        instagram: req.body.instagram || null,
      },
      order: req.body.order !== undefined ? Number(req.body.order) : 0,

      status: req.body.status !== undefined ? Number(req.body.status) : 1,
    };

    const job = await Job.create(jobData);

    res.status(201).json({
      status: true,
      message: "Job created",
      data: job,
    });
  } catch (err) {
    if (req.files?.company_logo?.[0]?.path) {
      fs.unlink(req.files.company_logo[0].path, (unlinkErr) => {
        if (unlinkErr) {
          console.log("File delete error:", unlinkErr.message);
        }
      });
    }

    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

const getAllJobs = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 100,
      location,
      minSalary,
      maxSalary,
      exp,
      fromDate,
      toDate,
    } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 100;

    // Admin (authenticated) requests see jobs of every status so they can
    // manage/reactivate inactive ones; the public route (no req.user) only
    // ever sees active (status: 1) jobs.
    let filter = req.user ? {} : { status: 1 };

    // LOCATION FILTER
    if (location) {
      filter.job_locations = {
        $elemMatch: {
          $regex: location,
          $options: "i", // case-insensitive
        },
      };
    }
    // SALARY FILTER
    if (minSalary || maxSalary) {
      filter["salary.min"] = { $gte: Number(minSalary || 0) };
      filter["salary.max"] = { $lte: Number(maxSalary || 99999999) };
    }

    // EXPERIENCE FILTER (months)
    // if (exp) {
    //   filter["experience.max"] = { $gte: Number(exp) };
    // }

    // DATE FILTER
    if (fromDate || toDate) {
      filter.$and = [];

      // Job Created Date (created_at)
      if (fromDate) {
        filter.$and.push({
          created_at: {
            $gte: new Date(fromDate),
          },
        });
      }

      // Last Date To Apply
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);

        filter.$and.push({
          last_date_to_apply: {
            $lte: endDate,
          },
        });
      }
    }

    const total = await Job.countDocuments(filter);

    const data = await Job.find(filter)
      .select(
        "company_logo job_title company_name salary salary_type job_locations experience order application_link status",
      )
      .sort({ order: 1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      status: true,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        status: false,
        message: "Job not found",
      });
    }

    res.json({
      status: true,
      data: job,
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const updateJob = async (req, res) => {
  try {
    // const job = await Job.findById(req.params.id);
    // const oldLogo = job.company_logo;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        status: false,
        message: "Job not found",
      });
    }

    const oldLogo = job.company_logo;

    if (!job) {
      return res.status(404).json({
        status: false,
        message: "Job not found",
      });
    }

    if ("salary_from" in req.body) {
      job.salary.min = Number(req.body.salary_from) || 0;
    }

    if ("salary_to" in req.body) {
      job.salary.max = Number(req.body.salary_to) || 0;
    }

    if ("salary_type" in req.body) {
      job.salary_type = req.body.salary_type || "PM";
    }

    if ("experience" in req.body) {
      job.experience = req.body.experience || null;
    }

    // normal fields
    if (req.body.job_title) job.job_title = req.body.job_title;
    if (req.body.company_name) job.company_name = req.body.company_name;
    if (req.body.job_description)
      job.job_description = req.body.job_description;
    if (req.body.apply_link) job.application_link = req.body.apply_link;

    if (req.body.recruiter_mobile_no) {
      job.recruiter_mobile_no = req.body.recruiter_mobile_no;
    }

    if (req.body.recruiter_whatsapp_no) {
      job.recruiter_whatsapp_no = req.body.recruiter_whatsapp_no;
    }

    if (req.body.recruiter_date) {
      job.recruiter_date = req.body.recruiter_date;
    }

    if (req.body.recruiter_expire_date) {
      job.recruiter_expire_date = req.body.recruiter_expire_date;
    }

    if (req.body.last_date_to_apply) {
      job.last_date_to_apply = req.body.last_date_to_apply;
    }

    // locations
    if (req.body.location) {
      job.job_locations = Array.isArray(req.body.location)
        ? req.body.location
        : [req.body.location];
    }

    //  logo update (important)
    if (req.files?.company_logo) {
      job.company_logo = req.files.company_logo[0].path;
    }

    if ("order" in req.body) {
      job.order = Number(req.body.order);
    }
    if ("status" in req.body) {
      job.status = Number(req.body.status);
    }

    job.updated_at = new Date();

    const updated = await job.save();

    if (req.files?.company_logo && oldLogo && fs.existsSync(oldLogo)) {
      fs.unlink(oldLogo, (err) => {
        if (err) {
          console.log("Old image delete error:", err.message);
        }
      });
    }

    res.json({
      status: true,
      message: "Updated successfully",
      data: updated,
    });
  } catch (err) {
    if (req.files?.company_logo?.[0]?.path) {
      fs.unlink(req.files.company_logo[0].path, (unlinkErr) => {
        if (unlinkErr) {
          console.log("File delete error:", unlinkErr.message);
        }
      });
    }

    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

const deleteJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        status: false,
        message: "Job not found",
      });
    }

    await Job.findByIdAndDelete(req.params.id);

    res.json({
      status: true,
      message: "Deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

const applyJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        status: false,
        message: "jobId required",
      });
    }

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        status: false,
        message: "Job not found",
      });
    }

    const exists = await JobApplication.findOne({
      job_id: jobId,
      user_id: req.user.id, // req.user._id nahi, token me id hai
    });

    if (exists) {
      return res.status(400).json({
        status: false,
        message: "Already applied",
      });
    }

    const application = await JobApplication.create({
      job_id: jobId,
      user_id: req.user.id,
    });

    res.json({
      status: true,
      message: "Applied successfully",
      data: application,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

const getAllUniqueJobTitles = async (req, res) => {
  try {
    const data = await Job.distinct("job_title", {
      status: 1,
    });

    return res.status(200).json({
      status: true,

      total: data.length,

      data,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,

      message: error.message,
    });
  }
};

const changeJobStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        status: false,
        message: "Job not found",
      });
    }

    job.status = job.status === 1 ? 2 : 1;

    job.updated_at = new Date();

    await job.save();

    return res.status(200).json({
      status: true,
      message: `Job status changed to ${job.status}`,
      data: job.status,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Mobile Apis ==============================================================================================================================

const appGetAllJobs = async (req, res) => {
  try {
    let { page = 1, limit = 100 } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);

    const skip = (page - 1) * limit;

    const total = await Job.countDocuments({
      status: 1,
    });

    const jobs = await Job.find({
      status: 1,
    })
      .sort({ order: 1, _id: -1 })
      .skip(skip)
      .limit(limit);

    const data = jobs.map((job) => {
      // const slug = job.job_title
      //   ?.toLowerCase()
      //   .trim()
      //   .replace(/[^\w\s-]/g, "")
      //   .replace(/\s+/g, "-");

      return {
        m_ju_id: String(job._id),

        m_ju_title: job.job_title || "",

        m_ju_image: job.company_logo || "",

        m_ju_desc: job.job_description || "",

        m_ju_salary_from:
          job.salary?.min > 0 ? String(job.salary.min) : "Not disclosed",

        m_ju_salary_to:
          job.salary?.max > 0 ? String(job.salary.max) : "Not disclosed",

        m_ju_location:
          job.job_locations?.length > 0 ? job.job_locations.join(", ") : "",

        m_ju_exp: job.experience || "",

        m_ju_exp_date: job.last_date_to_apply
          ? job.last_date_to_apply.toISOString().split("T")[0]
          : "",

        m_ju_slug: job.slug || "",

        link: job.application_link,
      };
    });

    return res.status(200).json({
      response: "success",

      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },

      data,
    });
  } catch (error) {
    return res.status(500).json({
      response: "error",
      message: error.message,
    });
  }
};

const appGetJobDetails = async (req, res) => {
  try {
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({
        response: "error",
        message: "job_id is required",
      });
    }

    const job = await Job.findById(job_id);

    if (!job) {
      return res.status(404).json({
        response: "error",
        message: "Job not found",
      });
    }

    return res.status(200).json({
      response: "success",
      data: [
        {
          m_ju_id: String(job._id),
          m_ju_title: job.job_title || "",
          m_ju_slug: job.slug || "",
          m_ju_emp_type: job.emp_type || "",
          m_ju_role_respo: job.role_respo || "",
          m_ju_desire_skill: job.desire_skill || "",
          m_ju_image: job.company_logo || "",
          m_ju_desc: job.job_description || "",
          m_ju_func_area: job.func_area || "",
          m_ju_interview_for: job.interview_for || "",
          m_ju_drive_name: job.drive_name || "",
          m_ju_vacancy: String(job.vacancy || ""),
          m_ju_company: job.company_name || "",
          m_ju_salary_from: job.salary.min || "",
          m_ju_salary_to: job.salary.max || "",
          m_ju_salary_type: String(job.salary_type || ""),
          m_ju_allowance: job.allowance || "",
          m_ju_state: job.m_ju_state || "",
          m_ju_location: job.job_locations?.join(", ") || "",
          m_ju_exp: job.experience || "",
          m_ju_qualification: job.qualification || "",
          m_ju_recruit_mo: job.recruiter_mobile_no || "",
          m_ju_recruit_whatsapp: job.recruiter_whatsapp_no || "",
          m_ju_recruit_date: job.recruiter_date || "",
          m_ju_exp_date: job.recruiter_expire_date || "",
          m_ju_mail_type: job.mail_type || "",
          m_ju_mail_reciev: job.mail_reciev || "",
          m_ju_mail: job.m_ju_mail || "",
          m_ju_order: String(job.order || ""),
          m_ju_status: String(job.status || ""),
          m_ju_added_on: job.created_at
            ? new Date(job.created_at)
                .toISOString()
                .replace("T", " ")
                .substring(0, 19)
            : "",
        },
      ],
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      response: "error",
      message: error.message,
    });
  }
};

module.exports = {
  addJob,
  getAllJobs,
  getJobById,
  updateJob,
  deleteJob,
  applyJob,
  getAllUniqueJobTitles,
  changeJobStatus,
  appGetAllJobs,
  appGetJobDetails,
};
