var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var debitSchema = new Schema({
    //isRegistered: Boolean,
    //user_user: String,
    //username: String,
    price: Number,
    paid: Number,
    paidStatus: Number,
    paidPending: Number
});

module.exports = mongoose.model('debitinfo', debitSchema);