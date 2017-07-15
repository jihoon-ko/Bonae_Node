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

function user_json_simple(user){
	return {
		name: user.name,
		facebook_id: user.facebook_id,
		account_bank: user.accountBank,
		account_number: user.accountNumber
	}
}

function debit_json(debit){
	if(debit.is_registered){
		return {
			is_registered: debit.isRegistered,
			user_info: user_json_simple(debit.user_user),
			price: debit.price,
			paid: debit.paid,
			paid_pending_status: debit.paidStatus,
			paid_pending: debit.paidPending
		}
	}else{
		return {
			is_registered: debit.isRegistered,
			user_info: debit.username,
			price: debit.price,
			paid: debit.paid,
			paid_pending_status: debit.paidStatus,
			paid_pending: debit.paidPending
		}
	}
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

function room_json(room){
	User.find({facebook_id: room.user_host}, function(err, user){
		if(err) return res.status(500).send({error: err});
		if(!user) return res.status(404).send({error: "cannot find user"});
		else{
			return {
				id: room._id,
				user_host: user_json_simple(user),
				debit_guests: (room.debit_guests).map(debit_json),
				created_date: room.createdDate,
				context_text: room.contextText,
				context_image: room.contextImage
			}
		}
	});
}

/* basic code finished */

router.post('/create/', function(req, res){
	return task_with_token(req, res,
		function(){
			var host = req.body.host;
			var guests = req.body.guests;
			var keyword = req.body.keyword;
			var divide = req.body.divide;
			var price = req.body.price;
			var price_list = req.body.price_list;
			var content_text = req.body.content_text;
			var content_image = req.body.content_image;
			if(!host || !guests || !keyword || (divide !== true && divide !== false)){
				return res.status(500).send({error: "some basic information missing"});
			}else{
				if(divide){
					price_list = [];
					for(var i=0;i<guests.length;i++){
						price_list.push(parseInt(price / (guests.length+1)));
					}
				}
				User.findOne({facebook_id: host}, function(err, user_host){
					if(err) return res.status(500).send({error: err});
					if(!user_host) return res.status(500).send({error: "cannot find host-user"});
					var room = new Room();
					console.log(price_list);
					var debit_list = [];
					var after_add_task = function(){
						user_host.room_pendingHost.push(room._id);
						user_host.save(function(err){
							if(err) return res.status(500).send({error: err});
							room.user_host = host;
							room.room_keyword = keyword;
							room.debit_guests = debit_list;
							room.contentText = content_text;
							room.contentImage = content_image;
							room.save(function(err){
								if(err) return res.status(500).send({error: err});
								return res.json({"id": room._id});
							});
						});
					}
					var add_rec = function(i, len, finish_task){
						if(i == len){
							finish_task();
						}else{
							var debit = new Debit();
							if(guests[i].substring(0, 1) !== '!'){
								User.findOne({facebook_id: guests[i]}, function(err, user){
									if(err) return res.status(500).send({error: err});
									if(!user) return res.status(500).send({error: "cannot find user"});
									user.room_pendingGuest.push(room._id);
									user.save(function(err){
										if(err) return res.status(500).send({error: err});
										debit.isRegistered = true;
										debit.user_user = guests[i];
										debit.price = price_list[i];
										debit.paid = 0;
										debit.paidStatus = 0;
										debit.paidPending = 0;
										debit.save(function(err){
											if(err) return res.status(500).send({error: err});
											else{
												debit_list.push(debit._id);
												return add_rec(i+1, len, finish_task);
											}
										});
									})
								});
							}else{
								debit.isRegistered = false;
								debit.username = guests[i].substring(1);
								debit.price = price_list[i];
								debit.paid = 0;
								debit.paidStatus = 0;
								debit.paidPending = 0;
								debit.save(function(err){
									if(err) return res.status(500).send({error: err});
									else{
										debit_list.push(debit._id);
										return add_rec(i+1, len, finish_task);
									}
								});
							}
						}
					}
					return add_rec(0, guests.length, after_add_task);
				});
			}
		});
});

router.get('/:id/', function(req, res){
	return task_with_token(req, res,
		function(){
			console.log(req.params.id)
			Room.findOne({_id: req.params.id}, function(err, room){
				if(err) return res.status(500).send({error: err});
				if(!room) return res.status(404).send({error: "cannot find room"});
				//else return res.json(room_json(room));
				return res.json(room);
			});
		});	
});

router.get('/debit/:id/', function(req, res){
	return task_with_token(req, res,
		function(){
			console.log(req.params.id)
			Debit.findOne({_id: req.params.id}, function(err, debit){
				if(err) return res.status(500).send({error: err});
				if(!debit) return res.status(404).send({error: "cannot find debit"});
				return res.json(debit);
			});
		});	
});
/*
router.get('/:id/detail/', function(req, res){
	return task_with_token(req, res,
		function(){
			console.log(req.params.id)
			Room.findOne({_id: req.params.id}, function(err, room){
				if(err) return res.status(500).send({error: err});
				if(!room) return res.status(404).send({error: "cannot find room"});
				else return res.json(room_json(room));
			});
		});	
});
*/

/* export part */
module.exports = router;
/* export part */