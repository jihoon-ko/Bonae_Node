var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var roomSchema = new Schema({
    user_host: String,
    debit_guests: [Schema.Types.ObjectId],
    createdDate: {type: Date, default: Date.now},
    contentText: String,
    contentImage: String
});
module.exports = mongoose.model('room', roomSchema);