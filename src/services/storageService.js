const { v2: cloudinary } = require("cloudinary");
const fs = require("fs");
const streamifier = require("streamifier");
const path = require("path");

// Config Cloudinary using your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "bcbhmpgp",
  api_key: process.env.CLOUDINARY_API_KEY || "699654349155336",
  api_secret: process.env.CLOUDINARY_API_SECRET || "giVEO20Bg-44zljrpZdnZqFu2Nw",
});

// const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "local";
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "cloudinary";

/**
 * Uploads local file to Cloudinary or falls back to local path.
 */
const uploadFile = async (localFilePath, folderName) => {
  if (!localFilePath) return null;

  if (STORAGE_PROVIDER === "cloudinary") {
    try {
      const uploadResult = await cloudinary.uploader.upload(localFilePath, {
        folder: folderName,
        resource_type: "auto", // handles image/video/pdf automatically
      });
      // console.log(uploadResult);
      return uploadResult.secure_url;
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      throw error;
    }
  }
  // Default fallback: return local file path
  return localFilePath;
};

/**
 * Deletes file from Cloudinary or local disk.
 */
const deleteFile = async (fileIdentifier) => {
  if (!fileIdentifier) return false;

  // File kept on this server's disk (see extractUploadedFile)
  if (String(fileIdentifier).startsWith("local:")) {
    const target = path.resolve(UPLOADS_DIR, String(fileIdentifier).slice("local:".length));
    if (!target.startsWith(UPLOADS_DIR + path.sep)) return false; // never leave the uploads folder
    try {
      await fs.promises.unlink(target);
      return true;
    } catch (err) {
      return err.code === "ENOENT"; // already gone is fine
    }
  }

  if (STORAGE_PROVIDER === "cloudinary") {
    try {
      let resourceType = "image";

      if (fileIdentifier.match(/\.(mp4|mkv|avi|mov)$/i)) {
        resourceType = "video";
      } else if (fileIdentifier.match(/\.pdf$/i)) {
        resourceType = "raw";
      }

      const result = await cloudinary.uploader.destroy(fileIdentifier, {
        resource_type: resourceType,
      });

      // console.log("Cloudinary Delete Result =>", result);

      return result.result === "ok" || result.result === "not found";
    } catch (error) {
      console.error("Cloudinary delete error:", error);
      return false;
    }
  }

  // Local Storage
  if (fs.existsSync(fileIdentifier)) {
    fs.unlinkSync(fileIdentifier);
    return true;
  }

  return false;
};

const deleteCertificateFile = async (fileIdentifier) => {
  if (!fileIdentifier) return false;

  if (STORAGE_PROVIDER === "cloudinary") {
    try {
      let resourceType = "raw";

      // if (fileIdentifier.match(/\.(mp4|mkv|avi|mov)$/i)) {
      //   resourceType = "video";
      // } else if (fileIdentifier.match(/\.pdf$/i)) {
      //   resourceType = "raw";
      // }

      const result = await cloudinary.uploader.destroy(fileIdentifier, {
        resource_type: resourceType,
      });

      // console.log("Cloudinary Delete Result =>", result);

      return result.result === "ok" || result.result === "not found";
    } catch (error) {
      console.error("Cloudinary delete error:", error);
      return false;
    }
  }

  // Local Storage
  if (fs.existsSync(fileIdentifier)) {
    fs.unlinkSync(fileIdentifier);
    return true;
  }

  return false;
};

const deleteVideoFromCloud = async (publicId) => {
  if (!publicId) return false;

  if (STORAGE_PROVIDER === "cloudinary") {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "video",
      });

      console.log("Cloudinary Video Delete:", result);

      return result.result === "ok" || result.result === "not found";
    } catch (error) {
      console.error("Cloudinary video delete error:", error);
      return false;
    }
  }

  if (fs.existsSync(publicId)) {
    fs.unlinkSync(publicId);
    return true;
  }

  return false;
};

const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

const extractUploadedFile = (file) => {
  if (!file) {
    return null;
  }

  // Saved on this server's disk (large files, see uploadMiddleware) rather than
  // Cloudinary: store a relative path the site can load from /uploads, and a
  // "local:" id that deleteFile knows how to remove.
  if (file.destination) {
    const rel = path.relative(UPLOADS_DIR, file.path).replace(/\\/g, "/");
    return { url: `uploads/${rel}`, public_id: `local:${rel}` };
  }

  return {
    url: file.path,
    public_id: file.filename,
  };
};

const uploadFileWithMeta = async (localFilePath, folderName) => {
  if (!localFilePath) return null;

  if (STORAGE_PROVIDER === "cloudinary") {
    try {
      const uploadResult = await cloudinary.uploader.upload(localFilePath, {
        folder: folderName,
        resource_type: "auto",
      });

      // console.log(uploadResult);

      return {
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        resource_type: uploadResult.resource_type,
      };
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      throw error;
    }
  }

  return {
    url: localFilePath,
    public_id: null,
    resource_type: null,
  };
};

const uploadBufferWithMeta = async (
  buffer,
  fileName,
  mimeType,
  folderName = "uploads",
) => {
  // if (STORAGE_PROVIDER !== "cloudinary") {
  //   return {
  //     url: null,
  //     public_id: null,
  //   };
  // }

  if (STORAGE_PROVIDER !== "cloudinary") {
    return {
      url: fileName,
      public_id: null,
      resource_type: null,
    };
  }

  let resourceType = "image";

  // if (mimeType === "application/pdf") {
  //   resourceType = "raw";
  // }

  // if (mimeType?.startsWith("video/")) {
  //   resourceType = "video";
  // }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        // public_id: fileName,
        public_id: path.parse(fileName).name.replace(/\s+/g, "_"),
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) return reject(error);

        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type,
        });
      },
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

module.exports = {
  uploadFile,
  deleteFile,
  deleteVideoFromCloud,
  extractUploadedFile,
  uploadFileWithMeta,
  uploadBufferWithMeta,
  deleteCertificateFile,
};
