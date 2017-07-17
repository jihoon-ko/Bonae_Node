var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var roomSchema = new Schema({
    user_host: String,
    room_keyword: String,
    debit_guests: [{id: Schema.Types.ObjectId, user: String}],
    createdDate: {type: Date, default: Date.now},
    contentText: String,
    contentImage: String
});
module.exports = mongoose.model('room', roomSchema);