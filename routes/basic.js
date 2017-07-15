/* basic code */

var express = require('express');
var router = express.Router();

var User = require('../models/user');
var Room = require('../models/room');
var Debit = require('../models/debit');
var Notification = require('../models/notification');

var secret_key = require('../keys/jwt_secret');
var jwt = require('jsonwebtoken');

function toHexString(byteArray) {
  return Array.from(byteArray, function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('')
}

function task_with_token(req, res, task_func){
	var token = req.headers['x-access-token']
	var fbid = req.headers['x-access-id']
	if(!token) return res.status(500).json({error: "cannot find token information"});
	jwt.verify(token, secret_key, function(err, decoded){
		if(err){
			return res.status(500).json({error: err});
		}else{
			User.findOne({facebook_id: fbid}, function(err, user){
				if(err) return res.status(500).json({error: "validation failed"});
				if(!user) return res.status(500).json({error: "validation failed"});
				if(user._id == toHexString(decoded.id.data)){
					task_func();
				}else{
					return res.status(500).json({error: "validation failed"});
				}
			});
		}
	});
}

function user_json(user){
	return {
		name: user.name,
		facebook_id: user.facebook_id,
		created_date: user.created_date,
		account_bank: user.accountBank,
		account_number: user.accountNumber,
		notification_notis: user.notification_notis,
		user_friend: user.user_friends,
		user_recent_people: user.user_recentPeople,
		room_pending_host: user.room_pendingHost,
		room_pending_guest: user.room_pendingGuest,
		room_ended_host: user.room_endedHost,
		room_ended_guest: user.room_endedGuest
	}
}

/* basic code finished */



/* export part */
module.exports = router;
/* export part */