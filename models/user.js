var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var userSchema = new Schema({
    facebook_id: String,
    name: String,
    userToken: String,
    profileImage: String,
    createdDate: {type: Date, default: Date.now},
    accountBank: String,
    accountNumber: String,
    // Foreign Schema: Room
    room_pendingHost: [Schema.Types.ObjectId],
    room_pendingGuest: [{room: Schema.Types.ObjectId, debit: Schema.Types.ObjectId}],
    room_endedHost: [Schema.Types.ObjectId],
    room_endedGuest: [{room: Schema.Types.ObjectId, debit: Schema.Types.ObjectId}],
    
    // Foreign Schema: User
    user_friends: [String],
    user_recentPeople: [String],
    
    // Foreign Schema: Notification
    notification_notis: [Schema.Types.ObjectId]
});
module.exports = mongoose.model('user', userSchema);