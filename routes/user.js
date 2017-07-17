var express = require('express');
var router = express.Router();

var User = require('../models/user');
var Room = require('../models/room');
var Debit = require('../models/debit');
var Notification = require('../models/notification');

var secret_key = require('../keys/jwt_secret');
var jwt = require('jsonwebtoken')

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
					console.log("authorization finished!\n");
					task_func();
				}else{
					return res.status(500).json({error: "validation failed"});
				}
			});
		}
	});
}

function transform_date(dateStr){
	let kd = new Date(new Date(dateStr).getTime() + 540 * 60000);
	let retStr = kd.getUTCFullYear() + '-' + ("0" + (kd.getUTCMonth()+1)).slice(-2) + '-' + ("0" + (kd.getUTCDate())).slice(-2) + " ";
	retStr = retStr + ("0" + (kd.getUTCHours())).slice(-2) + ":" + ("0" + (kd.getUTCMinutes())).slice(-2) + ":" + ("0" + (kd.getUTCSeconds())).slice(-2);
	return retStr;
}
function user_json(user, res){
	host_money = [];
	host_keyword = [];
	host_date = [];
	guest_money = [];
	guest_keyword = [];
	guest_date = [];
	guest_number = [];
	pending_host = user.room_pendingHost;
	pending_guest = user.room_pendingGuest;
	checking_guest_money = [];

	let get_guest_money = ((idx) => {
		let func = (() => {		
			if(idx == pending_guest.length){
				console.log(host_money);
				console.log(guest_money);
				console.log(checking_guest_money);
				return_pending_host = []
				return_pending_guest = []
				for(let i=0;i<host_money.length;i++){
					return_pending_host.push({
						"room": user.room_pendingHost[i],
						"keyword": host_keyword[i],
						"guest_number": guest_number[i],
						"left": host_money[i],
						"created_date": transform_date(host_date[i])
					});
				}
				for(let i=0;i<guest_money.length;i++){
					return_pending_guest.push({
						"room": user.room_pendingGuest[i].room,
						"debit": user.room_pendingGuest[i].debit,
						"keyword": guest_keyword[i],
						"left": guest_money[i],
						"pending" : checking_guest_money[i],
						"created_date": transform_date(guest_date[i])
					});
				}
				return res.json({
					name: user.name,
					facebook_id: user.facebook_id,
					created_date: user.created_date,
					account_bank: user.accountBank,
					account_number: user.accountNumber,
					notification_notis: user.notification_notis,
					user_friend: user.user_friends,
					user_recent_people: user.user_recentPeople,
					room_pending_host: return_pending_host,
					room_pending_guest: return_pending_guest,
					room_ended_host: user.room_endedHost,
					room_ended_guest: user.room_endedGuest
				});
			}else{
				Room.findOne({_id: pending_guest[idx].room}, function(err, room){
					if(err) return res.status(500).send({error: err});
					if(!room) return res.status(500).send({error: "cannot find room"});
					Debit.findOne({_id: pending_guest[idx].debit}, function(err, debit){
						if(err) return res.status(500).send({error: err});
						if(!debit) return res.status(500).send({error: "cannot find debit"});
						else{
							guest_money.push(debit.price - debit.paid);
							guest_keyword.push(room.room_keyword);
							guest_date.push(room.createdDate);
							checking_guest_money.push(debit.paidPending);
							console.log(debit.price, debit.paid);
							return get_guest_money(idx+1);
						}
					});
				});
			}
		});
		func();
	});
	let get_host_money = ((idx) => {
		let func = (() => {		
			if(idx == pending_host.length){
				return get_guest_money(0);
			}else{
				Room.findOne({_id: pending_host[idx]}, function(err, room){
					if(err) return res.status(500).send({error: err});
					if(!room) return res.status(500).send({error: "cannot find room"});
					else{
						debit_list = room.debit_guests;
						suum = 0;
						let getsum = ((i) => {
							let func = (() => {
								if(i == debit_list.length){
									host_money.push(suum);
									host_date.push(room.createdDate);
									guest_number.push({"left": room.debit_left, "total": room.debit_guests.length});
									host_keyword.push(room.room_keyword);
									return get_host_money(idx+1);
								}else{
									Debit.findOne({_id: debit_list[i].id}, function(err, debit){
										if(err) return res.status(500).send({error: err});
										if(!debit) return res.status(500).send({error: "cannot find debitInfo"});
										suum = suum + (debit.price - debit.paid);
										return getsum(i+1);
									});
								}
							});
							func();
						});
						//getsum(0);
						return getsum(0);
						/*
						console.log(getsum(0));
						return get_host_money(idx+1);
						*/
					}
				});
			}
		});
		func();
	});
	return get_host_money(0);
}

function save_username(res, user, username){
	user.name = username;
	user.save(function(err){
		if(err) return res.status(500).send({error: err});
		else return res.json({ok: "1"});
	})
}

function user_json_simple(user){
	console.log(user);
	return {
		name: user.name,
		//token: user.userToken,
		facebook_id: user.facebook_id,
		account_bank: user.accountBank,
		account_number: user.accountNumber
	}
}

router.get('/all/', function(req, res) {
	return task_with_token(req, res,
		function(){
			User.find(function(err, users){
				if(err) return res.status(500).send({error: err});
				else return res.json(users.map(user_json_simple));
			});
		});
});

router.get('/delete/', function(req, res) {
	var username = req.query.name;
	User.find({name: username}).remove().exec(function(err, data) { return res.json({ok: 1})});
});

router.get('/id/:fbId/', function(req, res){
	return task_with_token(req, res,
		function(){
			console.log(req.params.fbId)
			User.findOne({facebook_id: req.params.fbId}, function(err, user){
				if(err) return res.status(500).send({error: err});
				if(!user) return res.status(404).send({error: "cannot find user"});
				else return user_json(user, res);
			});
		});	
});
/*
router.get('/id/:myId/', function(req, res){
	return task_with_token(req, res,
		function(){
			User.findOne({_id: req.params.myId}, function(err, user){
				if(err) return res.status(500).send({error: err});
				if(!user) return res.status(404).send({error: "cannot find user"});
				else return res.json(user);
			});
		});	
});
*/

router.post('/changeInfo/:fbId', function(req, res){
	return task_with_token(req, res,
		function(){
			var fb_id = req.params.fbId;
			if(req.params.fbId !== req.headers['x-access-id']){
				return res.status(403).send({error: "you can't change other person's information!"});
			}else{
				var username = req.body.name;
				var account_bank = req.body.account_bank;
				var account_num = req.body.account_num;
				if(!username) return res.status(500).send({error: "username doesn't exist"});
				User.findOne({facebook_id: fb_id}, function(err, user){
					if(err) return res.status(500).send({error: err});
					if(!user) return res.status(404).send({error: "cannot find user"});
					else{
						user.accountBank = account_bank;
						user.accountNumber = account_num;
						if(username === user.name){
							return save_username(res, user, username);
						}else{
							User.findOne({name: username}, function(err, user2){
								if(err) return res.status(500).send({error: err});
								if(user2) return res.status(500).send({error: "name is duplicated"});
								else return save_username(res, user, username);
							});
						}
					}
				});
			}
		});
});

router.get('/check/', function(req, res){
	return task_with_token(req, res,
		function(){
			var fb_id = req.headers['x-access-id'];
			var username = req.query.name;
			console.log('username: ' + username);
			if(!username) return res.status(500).send({error: "username doesn't exist"});
			User.findOne({facebook_id: fb_id}, function(err, user){
				if(err) return res.status(500).send({error: err});
				if(!user) return res.status(404).send({error: "cannot find user"});
				else{
					if(username === user.name){
						return res.json({ok : "1"});
					}else{
						User.findOne({name: username}, function(err, user2){
							if(err) return res.status(500).send({error: err});
							if(user2) return res.json({ok: "0"});
							else return res.json({ok: "1"})
						});
					}
				}
			});
			
		});
});

router.get('/search/', function(req, res) {
	return task_with_token(req, res,
		function(){
			var username = req.query.name;
			User.find({name: {'$regex': username, '$options': 'i'}}, function(err, users){
				if(err) return res.status(500).send({error: err});
				else return res.json(users.map(user_json_simple));
			});
		});
});



module.exports = router;
