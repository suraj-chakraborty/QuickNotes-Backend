const { Schema, model } = require("mongoose");

const Document = new Schema(
  {
    _id: { type: String, required: true },
    title: { type: String, default: "Untitled Document" },
    data: { type: Object, default: "" },
  },
  { timestamps: true }
);

module.exports = model("Document", Document);