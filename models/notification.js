var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var notiSchema = new Schema({
    user_from: String,
    user_to: String,
    createdDate: {type: Date, default: Date.now},
    content: String,
    isDeleted: Number
});
module.exports = mongoose.model('notification', notiSchema);