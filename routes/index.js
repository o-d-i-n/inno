var express = require('express');
var passport = require('passport');
var Account = require('../models/account');
var router = express.Router();
var Hashids = require("hashids");
var nodemailer = require('nodemailer');
var mailgun = require('nodemailer-mailgun-transport');
var userLogic = require('../logic/userLogic.js');
var http = require('http');
var config = require('config');

var auth = config.get('mailgun');

var hashids = new Hashids(config.get('hashids').secret, config.get('hashids').no_chars, config.get('hashids').chars);
var mgMailer = nodemailer.createTransport(mailgun(auth));

router.get('/', function (req, res) {
    res.render('index', {user: req.user});
});

router.get('/wait', function (req, res) {
    res.render('wait');
});

router.get('/register', function (req, res) {
    res.render('register', {});
});

router.post('/register', function (req, res) {

    inno_id = '';
    Account.register(new Account({email: req.body.email,endpoint:req.body.endpoint}), req.body.password, function (err, account) {
        if (err) {
            return res.render('error', {message: err.message, error: err});
        }
        passport.authenticate('local')(req, res, function () {
            account.inno_id = 'I' + hashids.encode(account.accNo);
            inno_id = account.inno_id;
            account.save(function (err) {
                if(err)
                    console.log(err);
                else {
                    //userLogic.sendMail("User",req.body.email,"Congratulations you have registered, your Inno ID is: " + inno_id);
                    res.redirect('/users/details');
                }
            });
        });
    });
});

router.get('/login/fb', passport.authenticate('facebook', {authType: 'rerequest', scope: ['email']}));

router.get('/login/fb/callback',
    passport.authenticate('facebook', {
        failureRedirect: '/login'
    }), function(req, res) {
        if (req.user.is_new) {
            res.redirect('/users/details');
        } else {
            res.redirect('/');
        }
    }, function(err, req, res) {
        if(err) {
            req.logout();
            res.redirect('/login');
        }
    }
);

router.get('/login', function (req, res) {
    res.render('login');
});

router.post('/login', passport.authenticate('local', { failureRedirect: '/login' }), function (req, res) {

    console.log(req);

    if(req.user.endpoint == '') {
        req.user.endpoint = req.body.endpoint;

    }

    if (req.user.is_new)
        res.redirect('/users/details');
    res.redirect('/');
});

router.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

router.get('/contact', function(req, res) {
    if(req.isAuthenticated()) {
        res.render('contactUs', {user: req.user});
    } else {
        res.render('contactUs', {user: {}});
    }
});

router.post('/contact', function(req, res) {
    var mailOpts;

    mailOpts = {
        from: req.body.name + ' <' + req.body.email + '>', //grab form data from the request body object
        to: config.get('contactEmail'),
        subject: 'Inno Website Contact Form: ' + req.body.subject,
        text: req.body.mail
    };

    mgMailer.sendMail(mailOpts, function(err, response) {
        var user = {};
        if (req.isAuthenticated()) {
            user = req.user;
        }
        if (err) {
            res.render('contactUs', { msg: 'Error occured, message not sent.', err: true, user: user});
        } else {
            res.render('contactUs', { msg: 'Message Sent! Thank You.', err: false, user: {}});
        }
    })
});

router.get('/about', function(req, res) {
    res.render('about');
});

router.get('/sponsors', function(req, res) {
    res.render('sponsors');
});

router.get('/userInfo',function(req,res) {
   res.render('userInfo');
});

router.post('/userInfo',function(req,res) {
    if(req.body.inno_id[0] == 'I') {
        Account.findOne({inno_id:req.body.inno_id},function(err,user){

            if(!err && user) {
                res.render('userInfo', {message:user});
            } else {
                res.render('userInfo');
            }
        });

    } else {

        http.get({
            host: 'nsit-moksha.com',
            path: '/api/account/check_user.php?user='+req.body.inno_id
        }, function(response) {
            // Continuously update stream with data
            var body = '';
            response.on('data', function(d) {
                body += d;
            });
            response.on('end', function() {

                // Data reception is done, do whatever with it!
                var parsed = JSON.parse(body);
                res.render('userInfo',{message:body});
            });
        });


    }

});

router.get('/campus', function(req, res) {
    res.render('campus');
});

router.get('/emailBlast',userLogic.isAdmin,function(req,res){
    res.render('emailBlast');
});

router.post('/emailBlast',function(req,res) {

    var template;
    if(req.body.type=="initial"){
        template="emails/welcome";
    }

    if(req.body.inno_id == '') {
        Account.find({}, function (err, user) {
            for (i in user) {

                res.app.render(template,{user:user[i]},function(err,html) {
                    userLogic.sendMail(user[i].firstName, user[i].email, req.body.message,html);
                });

                if (user[i].endpoint != '') {
                    userLogic.sendPushNotif(user[i].endpoint, req.body.message);
                }
            }
        });
    } else {
        ids = req.body.inno_id.split(',');

        for(id in ids) {
            console.log(ids[id]);
            Account.findOne({inno_id:ids[id]},function(err,user){
               userLogic.sendMail(user.firstName,user.email,req.body.message);
            });
        }
    }
    res.render('emailBlast');
});

module.exports = router;