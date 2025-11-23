const crypto = require("crypto");
const { json } = require("./_common/auth");

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "method" });
    }

    // optioneel: alleen ingelogden
    if (!context.clientContext || !context.clientContext.user) {
      return json(401, { error: "auth" });
    }

    if (!process.env.CLOUDINARY_API_SECRET || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_CLOUD_NAME) {
      console.error('Cloudinary credentials not configured');
      return json(500, { error: "Cloudinary not configured" });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = (process.env.CLOUDINARY_FOLDER || "vrijeplek/logos").replace(/[^a-zA-Z0-9_\/-]/g, '');
    const str = `folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash("sha1").update(str).digest("hex");

    return json(200, {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      folder
    });
  } catch (err) {
    console.error('Cloudinary sign error:', err);
    const code = err.statusCode || 500;
    return json(code, { error: err.message || "Server error" });
  }
};
