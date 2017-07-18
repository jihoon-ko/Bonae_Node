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
/*
function debit_json(debit){
	if(debit.is_registered){
		return {
			price: debit.price,
			paid: debit.paid,
			paid_pending_status: debit.paidStatus,
			paid_pending: debit.paidPending
		}
	}else{
		return {
			price: debit.price,
			paid: debit.paid,
			paid_pending_status: debit.paidStatus,
			paid_pending: debit.paidPending
		}
	}
}
*/
function transform_date(dateStr){
	let kd = new Date(new Date(dateStr).getTime() + 540 * 60000);
	let retStr = kd.getUTCFullYear() + '-' + ("0" + (kd.getUTCMonth()+1)).slice(-2) + '-' + ("0" + (kd.getUTCDate())).slice(-2) + " ";
	retStr = retStr + ("0" + (kd.getUTCHours())).slice(-2) + ":" + ("0" + (kd.getUTCMinutes())).slice(-2) + ":" + ("0" + (kd.getUTCSeconds())).slice(-2);
	return retStr;
}

function user_json_simple(user){
	return {
		name: user.name,
		facebook_id: user.facebook_id,
		account_bank: user.accountBank,
		account_number: user.accountNumber
	}
}

function room_json(res, room){
	User.findOne({facebook_id: room.user_host}, function(err, user){
		if(err) return res.status(500).send({error: err});
		if(!user) return res.status(404).send({error: "cannot find user"});
		else{
			let return_debit_list = [];
			let len = room.debit_guests.length; 
			(get_debit = (idx) => {
				let func = () => {
					if(idx == len){
						var content_text = room.contentText;
						if(!room.contentText){
							content_text = "";
						}
						var content_image = room.contentImage;
						if(!room.contentImage){
							content_image = "";
						}
						return res.json({
							id: room._id,
							user_host: user_json_simple(user),
							debit_left: room.debit_left,
							debit_guests: return_debit_list,
							created_date: transform_date(room.createdDate),
							content_text: content_text,
							content_image: content_image
						});
					}else{
						let debit_id = room.debit_guests[idx].id;
						Debit.findOne({_id: debit_id}, function(err, debit){
							if(err) return res.status(500).send({error: err});
							if(!debit) return res.status(500).send({error: "cannot find debit"});
							else{
								let username = '';
								let userfb = '!';
								if(room.debit_guests[idx].user.substring(0,1) === '!'){
									username = room.debit_guests[idx].user.substring(1);
									userfb = '!';
									return_debit_list.push({
										"user": {
											"name": username,
											"facebook_id": userfb
										},
										"debit_id": room.debit_guests[idx].id,
										"price": debit.price,
										"paid": debit.paid,
										"paidStatus": debit.paidStatus,
										"paidPending": debit.paidPending
									});
									return get_debit(idx+1);
								}else{
									userfb = room.debit_guests[idx].user;
									User.findOne({facebook_id: userfb}, function(err, _user){
										if(err) return res.status(500).send({error: err});
										if(!_user) return res.status(500).send({error: "cannot find user"});
										else{
											username = _user.name;
											return_debit_list.push({
												"user": {
													"name": username,
													"facebook_id": userfb
												},
												"debit_id": room.debit_guests[idx].id,
												"price": debit.price,
												"paid": debit.paid,
												"paidStatus": debit.paidStatus,
												"paidPending": debit.paidPending
											});
											return get_debit(idx+1);
										}
									});
								}
							}
						});
					}
				};
				func();
			})(0);
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
				console.log("create room: some basic information missing");
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
							room.debit_left = debit_list.length;
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
									user.room_pendingGuest.push({room: room._id, debit: debit});
									user.save(function(err){
										if(err) return res.status(500).send({error: err});
										debit.user = guests[i];
										debit.room = room._id;
										debit.price = price_list[i];
										debit.paid = 0;
										debit.paidStatus = 0;
										debit.paidPending = 0;
										debit.save(function(err){
											if(err) return res.status(500).send({error: err});
											else{
												debit_list.push({id: debit._id, user: guests[i]});
												return add_rec(i+1, len, finish_task);
											}
										});
									})
								});
							}else{
								debit.user = guests[i];
								debit.room = room._id;
								debit.price = price_list[i];
								debit.paid = 0;
								debit.paidStatus = 0;
								debit.paidPending = 0;
								debit.save(function(err){
									if(err) return res.status(500).send({error: err});
									else{
										debit_list.push({id: debit._id, user: guests[i]});
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

router.get('/all/', function(req, res){
	return task_with_token(req, res,
		function(){
			Room.find({}, function(err, rooms){
				if(err) return res.status(500).send({error: err});
				if(!rooms) return res.status(404).send({error: "cannot find room"});
				return res.json(rooms);
			});
		});
});

router.get('/id/:id/', function(req, res){
	return task_with_token(req, res,
		function(){
			console.log(req.params.id)
			Room.findOne({_id: req.params.id}, function(err, room){
				if(err) return res.status(500).send({error: err});
				if(!room) return res.status(404).send({error: "cannot find room"});
				//else return res.json(room_json(room));
				return room_json(res, room);
			});
		});	
});
/*
router.get('/id/:id/', function(req, res){
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
*/
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

function validate_guest(debit, roomid, fbid){
	return ((debit.user === fbid) && (debit.room.toString() === roomid));
}

router.post('/id/:room_id/request/', function(req, res){
	return task_with_token(req, res,
		function(){
			let debit_id = req.body.id;
			let amount = req.body.amount;
			console.log(debit_id);
			console.log(amount);
			if((!debit_id) || (!amount)) return res.status(500).send({error: "invalid data"});
			Debit.findOne({_id: debit_id}, function(err, debit){
				if(err) return res.status(500).send({error: err});
				if(!debit) return res.status(404).send({error: "cannot find debit"});
				console.log("part1");
				Room.findOne({_id: req.params.room_id}, function(err, room){
					if(err) return res.status(500).send({error: err});
					if(!room) return res.status(404).send({error: "cannot find room"});
					console.log("part2");
					console.log(req.headers['x-access-id']);
					console.log(debit_id);
					if(!validate_guest(debit, req.params.room_id, req.headers['x-access-id'])){
						return res.status(500).send({error: "debit_id information is invalid"});
					}else{
						console.log("part3");
						if(debit.price - debit.paid < amount || amount <= 0){
							console.log("send - err1");
							return res.status(500).send({error: "invalid money"});
						}else if(debit.paidStatus !== 0){
							console.log("send - err2");
							return res.status(500).send({error: "already requested"});
						}else{
							console.log("part4");
							debit.paidStatus = 1;
							debit.paidPending = amount;
							debit.save((err) => {
								if(err) return res.status(500).send({error: err});
								return res.json({ok:"1"});
							});
						}
					}
				});
			});
		});
});

router.post('/id/:room_id/cancel/', function(req, res){
	return task_with_token(req, res,
		function(){
			let debit_id = req.body.id;
			if((!debit_id)) return res.status(500).send({error: "invalid data"});
			Debit.findOne({_id: debit_id}, function(err, debit){
				if(err) return res.status(500).send({error: err});
				if(!debit) return res.status(404).send({error: "cannot find debit"});
				Room.findOne({_id: req.params.room_id}, function(err, room){
					if(err) return res.status(500).send({error: err});
					if(!room) return res.status(404).send({error: "cannot find room"});
					if(!validate_guest(debit, req.params.room_id, req.headers['x-access-id'])){
						return res.status(500).send({error: "debit_id information is invalid"});
					}else{
						if(debit.paidStatus !== 1){
							console.log("send - err2");
							return res.status(500).send({error: "already canceled"});
						}else{
							debit.paidStatus = 0;
							debit.paidPending = 0;
							debit.save((err) => {
								if(err) return res.status(500).send({error: err});
								return res.json({ok:"1"});
							});
						}
					}
				});
			});
		});
});

router.post('/id/:room_id/reject/', function(req, res){
	return task_with_token(req, res,
		function(){
			let debit_id = req.body.id;
			if((!debit_id)) return res.status(500).send({error: "invalid data"});
			Debit.findOne({_id: debit_id}, function(err, debit){
				if(err) return res.status(500).send({error: err});
				if(!debit) return res.status(404).send({error: "cannot find debit"});
				Room.findOne({_id: req.params.room_id}, function(err, room){
					if(err) return res.status(500).send({error: err});
					if(!room) return res.status(404).send({error: "cannot find room"});
					if(room.user_host !== req.headers['x-access-id'] || room._id.toString() !== debit.room.toString()){
						return res.status(500).send({error: "host information is invalid"});
					}else{
						if(debit.paidStatus !== 1){
							console.log("send - err2");
							return res.status(500).send({error: "already canceled"});
						}else{
							debit.paidStatus = 0;
							debit.paidPending = 0;
							debit.save((err) => {
								if(err) return res.status(500).send({error: err});
								return res.json({ok:"1"});
							});
						}
					}
				});
			});
		});
});

function accept_task(req, res, room, debit){
	debit.paidStatus = 2;
	debit.save(function(err){
		if(err) return res.status(500).send({error: err});
		room.debit_left -= 1;
		room.save(function(err){
			if(err) return res.status(500).send({error: err});
			if(room.debit_left == 0){
				fbid = req.headers['x-access-id'];
				User.findOne({facebook_id: fbid}, function(err, host_user){
					for(let i=0;i<host_user.room_pendingHost.length;i++){
						if(host_user.room_pendingHost[i].toString() == req.params.room_id){
							host_user.room_pendingHost.splice(i, 1);
							break;
						}
					}
					host_user.room_endedHost.push(room._id);
					host_user.save(function(err){
						if(err) return res.status(500).send({error: err});
						if(debit.user.substring(0,1) !== '!'){
							User.findOne({facebook_id: debit.user}, function(err, guest_user){
								for(let i=0;i<guest_user.room_pendingGuest.length;i++){
									if(guest_user.room_pendingGuest[i].room.toString() == req.params.room_id){
										guest_user.room_pendingGuest.splice(i, 1);
										break;
									}
								}
								guest_user.room_endedGuest.push({room: room._id, debit: debit._id});
								guest_user.save(function(err){
									if(err) return res.status(500).send({error: err});
									return res.json({ok: "1"});
								});
							});
						}else{
							return res.json({ok: "1"});
						}
					});
				});
			}else{
				if(debit.user.substring(0,1) !== '!'){
					User.findOne({facebook_id: debit.user}, function(err, guest_user){
						for(let i=0;i<guest_user.room_pendingGuest.length;i++){
							if(guest_user.room_pendingGuest[i].room.toString() == req.params.room_id){
								guest_user.room_pendingGuest.splice(i, 1);
								break;
							}
						}
						guest_user.room_endedGuest.push({room: room._id, debit: debit._id});
						guest_user.save(function(err){
							if(err) return res.status(500).send({error: err});
							return res.json({ok: "1"});
						});
					});
				}else{
					return res.json({ok: "1"});
				}
			}
		});
	});
}

router.post('/id/:room_id/accept/', function(req, res){
	return task_with_token(req, res,
		function(){
			let debit_id = req.body.id;
			if((!debit_id)) return res.status(500).send({error: "invalid data"});
			Room.findOne({_id: req.params.room_id}, function(err, room){
				if(err) return res.status(500).send({error: err});
				if(!room) return res.status(404).send({error: "cannot find room"});
				if(room.user_host !== req.headers['x-access-id']){
					return res.status(500).send({error: "host information is invalid"});
				}else{
					Debit.findOne({_id: debit_id}, function(err, debit){
						if(err) return res.status(500).send({error: err});
						if(!debit) return res.status(404).send({error: "cannot find debit"});
						if(debit.paidStatus == 1){
							debit.paid = debit.paid + debit.paidPending;
							debit.paidStatus = 0;
							debit.paidPending = 0;
							debit.save((err) => {
								if(err) return res.status(500).send({error: err});
								if(debit.paid === debit.price){
									return accept_task(req, res, room, debit);
								}else{
									return res.json({ok: "1"});
								}
							});
						}else if(debit.paidStatus == 0){
							debit.paid = debit.price;
							debit.paidPending = 0;
							return accept_task(req, res, room, debit);
						}else{
							return res.status(500).send({error: "Internal Server Error"});
						}
					});
				}
			});
		});
});


router.get('/test/test/', function(req, res){
	/*
	Room.find({}, function(err, rooms){
		let updFunc = (i) => {
			let func = () => {
				if(i == rooms.length){
					return res.json({ok: "1"});
				}else{
					let updDebit = (j) => {
						console.log(i + " " + j);
						if(j == rooms[i].debit_guests.length){
							return updFunc(i+1);
						}else{
							Debit.findOne({_id: rooms[i].debit_guests[j].id}, (err, debit) => {
								debit.user = rooms[i].debit_guests[j].user;
								debit.room = rooms[i]._id;
								debit.save((err) => {
									return updDebit(j+1);
								});
							});
						}
					};
					return updDebit(0);
				}
			};
			func();
		};
		return updFunc(0);
	});
	*/
	Room.findOne({_id: "596c9c3f35bdb00d781af667"}, function(err, user){
		console.log(user.contentText);
		user.save((err) => {
			if(err) res.status(500).send({error: err});
			return res.json({ok: "1"});
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