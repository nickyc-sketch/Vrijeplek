const crypto = require("crypto");
const { json } = require("./_common/auth");

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return json(405, { error:"method" });
  // optioneel: alleen ingelogden
  if (!context.clientContext || !context.clientContext.user) return json(401, { error:"auth" });

  const timestamp = Math.floor(Date.now()/1000);
  const folder = process.env.CLOUDINARY_FOLDER || "vrijeplek/logos";
  const str = `folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash("sha1").update(str).digest("hex");

  return json(200, {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    timestamp, signature, folder
  });
};
