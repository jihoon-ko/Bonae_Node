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
					task_func();
				}else{
					return res.status(500).json({error: "validation failed"});
				}
			});
		}
	});
}

router.get('/all/', function(req, res) {
	return task_with_token(req, res,
		function(){
			User.find(function(err, users){
				if(err) return res.status(500).send({error: err});
				else return res.json(users);
			});
		});
});

router.get('/delete/', function(req, res) {
	User.find().remove().exec(function(err, data) { return res.json({ok: 1})});
});

router.get('/:fbId/', function(req, res){
	return task_with_token(req, res,
		function(){
			User.findOne({facebook_id: req.params.fbId}, function(err, user){
				if(err) return res.status(500).send({error: err});
				if(!user) return res.status(404).send({error: "cannot find user"});
				else return res.json(user);
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

function save_username(res, user, username){
	user.name = username;
	user.save(function(err){
		if(err) return res.status(500).send({error: err});
		else return res.json({ok: "1"});
	})
}

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
module.exports = router;