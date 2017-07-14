var express = require('express');
var router = express.Router();
var Promise = require('promise');

var User = require('../models/user');
var request = require('request');

var secret_key = require('../keys/jwt_secret');
var jwt = require('jsonwebtoken')

function create_new_user(new_user, id, name){
	new_user.facebook_id = id;
	new_user.name = name;
	new_user.profileImage = "";
	new_user.accountBank = "";
	new_user.accountNumber = "";
	new_user.room_pendingHost = [];
	new_user.room_pendingGuest = [];
	new_user.room_endedHost = [];
	new_user.room_endedGuest = [];
	new_user.user_friends = [];
	new_user.user_recentPeople = [];
	new_user.user_notification_notis = [];
	new_user.userToken = "";							
}

router.post('/login/', function(req, res){
	var fb_token = "121";
	request('https://graph.facebook.com/v2.9/oauth/access_token?client_id=278453325891792&client_secret=c81fea2ba1ef6debb7f690d5ff3134eb&grant_type=client_credentials', function(err, result, body){
		if(err) return res.status(500).send({error: err});
		fb_token = JSON.parse(body).access_token;
		//console.log(fb_token);
		var token_split = fb_token.split('|')
		if(token_split[0] === req.body.appid){
			request('https://graph.facebook.com/v2.9/'+req.body.id+'/?fields=id,name&locale=ko_KR&access_token=' + token_split[0] + '|' + token_split[1], function(err, result, body){
				if(err) return res.status(500).send({error: err});
				var body_json = JSON.parse(body)
				//console.log(body_json);
				if(req.body.name == body_json.name){
					console.log("Login Success");
					User.findOne({facebook_id: req.body.id}, function(err, user){
						if(err) res.status(500).send({error: err});
						if(!user){
							console.log("create new user");
							var promiseUser = new Promise(function(resolve, reject){
								var new_user = new User();
								create_new_user(new_user, req.body.id, req.body.name);
								new_user.save(function(err){
									//console.log("err:" + err);
									if(err){
										reject();
									}
									else{
										user = new_user;
										resolve();
									}
								});
							});
							promiseUser
							.catch(function(){
								return res.status(500).send({error: "error while get user"});
							})
							.then(function(){
								jwt.sign(user._id, secret_key, {expiresIn: '15d'}, function(err, token){
									if(err) return res.status(500).send({error: "token creation failed"});
									else{
										//console.log(token);
										user.userToken = token;
										user.save(function(err){
											return res.json({token: token, first_login: true});
										});
									}
								});
							});
						}else{
							if(user.userToken === ""){
								jwt.sign(user._id, secret_key, {expiresIn: '15d'}, function(err, token){
									if(err) return res.status(500).send({error: "token creation failed"});
									else{
										user.userToken = token;
										user.save(function(err){
											return res.json({token: token, first_login: false});
										});
									}
								});
							}else{
								return res.json({token: user.userToken, first_login: false});
							}
						}
					});
				}else{
					return res.status(500).send({error: "name doesn't match"});
				}
			});
		}else{
			return res.status(500).send({error: "app_id doesn't match"});
		}
	});
});

module.exports = router;
