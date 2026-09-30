const Country = require("../models/country");
const State = require("../models/state");
const City = require("../models/city");
const mongoose = require("mongoose");

// ======================================================
// COMMON VALIDATION
// ======================================================

const isValidObjectId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

const isValidValue = (value) => {
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    value !== "null"
  );
};

// ======================================================
// COUNTRY APIs
// ======================================================

// ADD COUNTRY
const addCountry = async (req, res) => {
  try {
    const { m_country_name } = req.body;

    if (!isValidValue(m_country_name)) {
      return res.status(400).send({
        status: false,
        message: "Country name is required",
      });
    }

    const checkCountry = await Country.findOne({
      m_country_name: m_country_name.trim(),
    });

    if (checkCountry) {
      return res.status(400).send({
        status: false,
        message: "Country already exists",
      });
    }

    const country = await Country.create({
      m_country_name: m_country_name.trim(),
    });

    return res.status(201).send({
      status: true,
      message: "Country added successfully",
      data: country,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// UPDATE COUNTRY
const updateCountry = async (req, res) => {
  try {
    const { id } = req.params;
    const { m_country_name } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid country id",
      });
    }

    const country = await Country.findById(id);

    if (!country) {
      return res.status(404).send({
        status: false,
        message: "Country not found",
      });
    }

    if (isValidValue(m_country_name)) {
      country.m_country_name = m_country_name.trim();
    }

    await country.save();

    return res.status(200).send({
      status: true,
      message: "Country updated successfully",
      data: country,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// GET ALL COUNTRIES
const getAllCountry = async (req, res) => {
  try {
    const data = await Country.find().sort({ m_country_name: 1 });

    return res.status(200).send({
      status: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// GET SINGLE COUNTRY
const getSingleCountry = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid country id",
      });
    }

    const data = await Country.findById(id);

    if (!data) {
      return res.status(404).send({
        status: false,
        message: "Country not found",
      });
    }

    return res.status(200).send({
      status: true,
      data,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// COUNTRY DROPDOWN
const getCountryDropdown = async (req, res) => {
  try {
    const data = await Country.find(
      {},
      {
        m_country_name: 1,
      }
    ).sort({ m_country_name: 1 });

    return res.status(200).send({
      status: true,
      data,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// DELETE COUNTRY
const deleteCountry = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid country id",
      });
    }

    const stateExist = await State.findOne({
      m_state_country: id,
    });

    if (stateExist) {
      return res.status(400).send({
        status: false,
        message: "Country is connected with states",
      });
    }

    const cityExist = await City.findOne({
      m_city_country: id,
    });

    if (cityExist) {
      return res.status(400).send({
        status: false,
        message: "Country is connected with cities",
      });
    }

    const deleted = await Country.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).send({
        status: false,
        message: "Country not found",
      });
    }

    return res.status(200).send({
      status: true,
      message: "Country deleted successfully",
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// ======================================================
// STATE APIs
// ======================================================

// ADD STATE
const addState = async (req, res) => {
  try {
    const { m_state_name, m_state_country } = req.body;

    if (!isValidValue(m_state_name)) {
      return res.status(400).send({
        status: false,
        message: "State name is required",
      });
    }

    if (isValidValue(m_state_country)) {
      if (!isValidObjectId(m_state_country)) {
        return res.status(400).send({
          status: false,
          message: "Invalid country id",
        });
      }

      const countryExist = await Country.findById(m_state_country);

      if (!countryExist) {
        return res.status(404).send({
          status: false,
          message: "Country not found",
        });
      }
    }

    const state = await State.create({
      m_state_name: m_state_name.trim(),
      m_state_country: isValidValue(m_state_country)
        ? m_state_country
        : null,
    });

    return res.status(201).send({
      status: true,
      message: "State added successfully",
      data: state,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// UPDATE STATE
const updateState = async (req, res) => {
  try {
    const { id } = req.params;
    const { m_state_name, m_state_country } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid state id",
      });
    }

    const state = await State.findById(id);

    if (!state) {
      return res.status(404).send({
        status: false,
        message: "State not found",
      });
    }

    if (isValidValue(m_state_name)) {
      state.m_state_name = m_state_name.trim();
    }

    if (m_state_country !== undefined) {
      if (isValidValue(m_state_country)) {
        if (!isValidObjectId(m_state_country)) {
          return res.status(400).send({
            status: false,
            message: "Invalid country id",
          });
        }

        const countryExist = await Country.findById(m_state_country);

        if (!countryExist) {
          return res.status(404).send({
            status: false,
            message: "Country not found",
          });
        }

        state.m_state_country = m_state_country;
      } else {
        state.m_state_country = null;
      }
    }

    await state.save();

    return res.status(200).send({
      status: true,
      message: "State updated successfully",
      data: state,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// GET ALL STATES
const getAllState = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      m_state_country,
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    // ======================================================
    // FILTER OBJECT
    // ======================================================

    let filter = {};

    // FILTER BY COUNTRY ID
    if (
      m_state_country &&
      m_state_country !== "null" &&
      m_state_country !== ""
    ) {
      if (!mongoose.Types.ObjectId.isValid(m_state_country)) {
        return res.status(400).send({
          status: false,
          message: "Invalid country id",
        });
      }

      filter.m_state_country = m_state_country;
    }

    // ======================================================
    // TOTAL COUNT
    // ======================================================

    const totalCount = await State.countDocuments(filter);

    // ======================================================
    // GET DATA
    // ======================================================

    const data = await State.find(filter)
      .populate("m_state_country", "m_country_name")
      .sort({ m_state_name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).send({
      status: true,

      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount,
        perPage: limit,
      },

      data,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// GET SINGLE STATE
const getSingleState = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid state id",
      });
    }

    const data = await State.findById(id).populate(
      "m_state_country",
      "m_country_name"
    );

    if (!data) {
      return res.status(404).send({
        status: false,
        message: "State not found",
      });
    }

    return res.status(200).send({
      status: true,
      data,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// STATE DROPDOWN
const getStateDropdown = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 100,
      m_state_country,
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    // ======================================================
    // FILTER OBJECT
    // ======================================================

    let filter = {};

    // FILTER BY COUNTRY
    if (
      m_state_country &&
      m_state_country !== "null" &&
      m_state_country !== ""
    ) {
      if (!mongoose.Types.ObjectId.isValid(m_state_country)) {
        return res.status(400).send({
          status: false,
          message: "Invalid country id",
        });
      }

      filter.m_state_country = m_state_country;
    }

    // ======================================================
    // TOTAL COUNT
    // ======================================================

    const totalCount = await State.countDocuments(filter);

    // ======================================================
    // GET DATA
    // ======================================================

    const data = await State.find(
      filter,
      {
        m_state_name: 1,
      }
    )
      .sort({ m_state_name: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).send({
      status: true,
      response: "success",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount,
        perPage: limit,
      },
      data,
      // Android-compatible format
      states: data.map((doc) => ({
        m_state_id: String(doc._id),
        m_state_name: doc.m_state_name,
      })),
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// DELETE STATE
const deleteState = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid state id",
      });
    }

    const cityExist = await City.findOne({
      m_city_state: id,
    });

    if (cityExist) {
      return res.status(400).send({
        status: false,
        message: "State is connected with cities",
      });
    }

    const deleted = await State.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).send({
        status: false,
        message: "State not found",
      });
    }

    return res.status(200).send({
      status: true,
      message: "State deleted successfully",
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// ======================================================
// CITY APIs
// ======================================================

// ADD CITY
const addCity = async (req, res) => {
  try {
    const {
      m_city_country,
      m_city_state,
      m_city_city,
      m_city_status,
    } = req.body;

    // ======================================================
    // CITY NAME REQUIRED
    // ======================================================

    if (!isValidValue(m_city_city)) {
      return res.status(400).send({
        status: false,
        message: "City name is required",
      });
    }

    let countryData = null;
    let stateData = null;

    // ======================================================
    // COUNTRY VALIDATION
    // ======================================================

    if (isValidValue(m_city_country)) {
      // CHECK OBJECT ID
      if (!isValidObjectId(m_city_country)) {
        return res.status(400).send({
          status: false,
          message: "Invalid country id",
        });
      }

      // CHECK COUNTRY EXISTS
      countryData = await Country.findById(m_city_country);

      if (!countryData) {
        return res.status(404).send({
          status: false,
          message: "Country not found",
        });
      }
    }

    // ======================================================
    // STATE VALIDATION
    // ======================================================

    if (isValidValue(m_city_state)) {
      // CHECK OBJECT ID
      if (!isValidObjectId(m_city_state)) {
        return res.status(400).send({
          status: false,
          message: "Invalid state id",
        });
      }

      // CHECK STATE EXISTS
      stateData = await State.findById(m_city_state);

      if (!stateData) {
        return res.status(404).send({
          status: false,
          message: "State not found",
        });
      }
    }

    // ======================================================
    // CHECK STATE BELONGS TO COUNTRY
    // ======================================================

    /*
      VALIDATION WILL RUN ONLY IF:
      - COUNTRY EXISTS
      - STATE EXISTS
      - STATE HAS COUNTRY CONNECTION
    */

    if (
      countryData &&
      stateData &&
      stateData.m_state_country
    ) {
      if (
        stateData.m_state_country.toString() !==
        m_city_country.toString()
      ) {
        return res.status(400).send({
          status: false,
          message:
            "Selected state does not belong to selected country",
        });
      }
    }

    // ======================================================
    // CREATE CITY
    // ======================================================

    const city = await City.create({
      m_city_country: isValidValue(m_city_country)
        ? m_city_country
        : null,

      m_city_state: isValidValue(m_city_state)
        ? m_city_state
        : null,

      m_city_city: m_city_city.trim(),

      m_city_status:
        m_city_status !== undefined
          ? m_city_status
          : 0,
    });

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(201).send({
      status: true,
      message: "City added successfully",
      data: city,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// UPDATE CITY
const updateCity = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      m_city_country,
      m_city_state,
      m_city_city,
      m_city_status,
    } = req.body;

    // ======================================================
    // CITY ID VALIDATION
    // ======================================================

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid city id",
      });
    }

    // ======================================================
    // CHECK CITY EXISTS
    // ======================================================

    const city = await City.findById(id);

    if (!city) {
      return res.status(404).send({
        status: false,
        message: "City not found",
      });
    }

    let countryData = null;
    let stateData = null;

    // ======================================================
    // COUNTRY VALIDATION
    // ======================================================

    if (m_city_country !== undefined) {
      // REMOVE COUNTRY CONNECTION
      if (!isValidValue(m_city_country)) {
        city.m_city_country = null;
      } else {
        // CHECK OBJECT ID
        if (!isValidObjectId(m_city_country)) {
          return res.status(400).send({
            status: false,
            message: "Invalid country id",
          });
        }

        // CHECK COUNTRY EXISTS
        countryData = await Country.findById(
          m_city_country
        );

        if (!countryData) {
          return res.status(404).send({
            status: false,
            message: "Country not found",
          });
        }

        city.m_city_country = m_city_country;
      }
    }

    // ======================================================
    // STATE VALIDATION
    // ======================================================

    if (m_city_state !== undefined) {
      // REMOVE STATE CONNECTION
      if (!isValidValue(m_city_state)) {
        city.m_city_state = null;
      } else {
        // CHECK OBJECT ID
        if (!isValidObjectId(m_city_state)) {
          return res.status(400).send({
            status: false,
            message: "Invalid state id",
          });
        }

        // CHECK STATE EXISTS
        stateData = await State.findById(
          m_city_state
        );

        if (!stateData) {
          return res.status(404).send({
            status: false,
            message: "State not found",
          });
        }

        city.m_city_state = m_city_state;
      }
    }

    // ======================================================
    // FINAL RELATION VALIDATION
    // ======================================================

    /*
      FINAL VALUES AFTER UPDATE
    */

    const finalCountry =
      city.m_city_country?.toString() || null;

    const finalState =
      city.m_city_state?.toString() || null;

    /*
      CHECK:
      STATE BELONGS TO COUNTRY
    */

    if (finalCountry && finalState) {
      const stateInfo = await State.findById(
        finalState
      );

      if (
        stateInfo &&
        stateInfo.m_state_country &&
        stateInfo.m_state_country.toString() !==
          finalCountry
      ) {
        return res.status(400).send({
          status: false,
          message:
            "Selected state does not belong to selected country",
        });
      }
    }

    // ======================================================
    // UPDATE CITY NAME
    // ======================================================

    if (isValidValue(m_city_city)) {
      city.m_city_city = m_city_city.trim();
    }

    // ======================================================
    // UPDATE STATUS
    // ======================================================

    if (m_city_status !== undefined) {
      city.m_city_status = m_city_status;
    }

    // ======================================================
    // SAVE
    // ======================================================

    await city.save();

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).send({
      status: true,
      message: "City updated successfully",
      data: city,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// GET ALL CITY
const getAllCity = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      m_city_country,
      m_city_state,
    } = req.query;

    page = Number(page);
    limit = Number(limit);

    // ======================================================
    // FILTER OBJECT
    // ======================================================

    let filter = {};

    // ======================================================
    // FILTER BY COUNTRY
    // ======================================================

    if (
      m_city_country &&
      m_city_country !== "null" &&
      m_city_country !== ""
    ) {
      if (!isValidObjectId(m_city_country)) {
        return res.status(400).send({
          status: false,
          message: "Invalid country id",
        });
      }

      filter.m_city_country = m_city_country;
    }

    // ======================================================
    // FILTER BY STATE
    // ======================================================

    if (
      m_city_state &&
      m_city_state !== "null" &&
      m_city_state !== ""
    ) {
      if (!isValidObjectId(m_city_state)) {
        return res.status(400).send({
          status: false,
          message: "Invalid state id",
        });
      }

      filter.m_city_state = m_city_state;
    }

    // ======================================================
    // TOTAL COUNT
    // ======================================================

    const totalCount = await City.countDocuments(filter);

    // ======================================================
    // GET DATA
    // ======================================================

    const data = await City.find(filter)
      .populate("m_city_country", "m_country_name")
      .populate("m_city_state", "m_state_name")
      .sort({ m_city_city: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).send({
      status: true,

      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount,
        perPage: limit,
      },

      data,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// GET SINGLE CITY
const getSingleCity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid city id",
      });
    }

    const data = await City.findById(id)
      .populate("m_city_country", "m_country_name")
      .populate("m_city_state", "m_state_name");

    if (!data) {
      return res.status(404).send({
        status: false,
        message: "City not found",
      });
    }

    return res.status(200).send({
      status: true,
      data,
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// CITY DROPDOWN
const getCityDropdown = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 100,
      m_city_country,
      m_city_state,
    } = req.query;

    // Android posts state_id in form body (POST /public/city/dropdown)
    if (!m_city_state && req.body && req.body.state_id) {
      m_city_state = req.body.state_id;
    }

    page = Number(page);
    limit = Number(limit);

    // ======================================================
    // FILTER OBJECT
    // ======================================================

    let filter = {};

    // ======================================================
    // FILTER BY COUNTRY
    // ======================================================

    if (
      m_city_country &&
      m_city_country !== "null" &&
      m_city_country !== ""
    ) {
      if (!isValidObjectId(m_city_country)) {
        return res.status(400).send({
          status: false,
          message: "Invalid country id",
        });
      }

      filter.m_city_country = m_city_country;
    }

    // ======================================================
    // FILTER BY STATE
    // ======================================================

    if (
      m_city_state &&
      m_city_state !== "null" &&
      m_city_state !== ""
    ) {
      if (!isValidObjectId(m_city_state)) {
        return res.status(400).send({
          status: false,
          message: "Invalid state id",
        });
      }

      filter.m_city_state = m_city_state;
    }

    // ======================================================
    // TOTAL COUNT
    // ======================================================

    const totalCount = await City.countDocuments(filter);

    // ======================================================
    // GET DATA
    // ======================================================

    const data = await City.find(
      filter,
      {
        m_city_city: 1,
      }
    )
      .sort({ m_city_city: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // ======================================================
    // RESPONSE
    // ======================================================

    return res.status(200).send({
      status: true,
      response: "success",
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount,
        perPage: limit,
      },
      data,
      // Android-compatible format
      city: data.map((doc) => ({
        m_location_id: String(doc._id),
        m_location_city: doc.m_city_city,
      })),
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};

// DELETE CITY
const deleteCity = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).send({
        status: false,
        message: "Invalid city id",
      });
    }

    const deleted = await City.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).send({
        status: false,
        message: "City not found",
      });
    }

    return res.status(200).send({
      status: true,
      message: "City deleted successfully",
    });
  } catch (error) {
    return res.status(500).send({
      status: false,
      message: error.message,
    });
  }
};


module.exports = {
  addCountry,
  updateCountry,
  getAllCountry,
  getSingleCountry,
  getCountryDropdown,
  deleteCountry,
  addState,
  updateState,
  getAllState,
  getSingleState,
  getStateDropdown,
  deleteState,
  addCity,
  updateCity,
  getAllCity,
  getSingleCity,
  getCityDropdown,
  deleteCity
}