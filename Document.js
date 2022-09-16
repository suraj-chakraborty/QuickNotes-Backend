const { Schema, model } = require("mongoose")

const Document = new Schema({
    _id: 'string',
    data: 'object',
})

module.exports = model('Document', Document)