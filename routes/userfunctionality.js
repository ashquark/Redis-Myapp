const express = require('express');
const router = express.Router();
const path = require("path");

const redis = require('../utils/redisclient');
const redisClient = redis.getClient();

const { UserObj, LocationObj, LocationDetailsObj, RatingObj } = require("../utils/dataloader");
const { count } = require('console');

const { get } = require('http');

// Login route
router.get('/userLoginSignup', (req, res) => {
    // Render the login page here
    if (req.session.userId) {
        res.redirect('/userDashboard');
    } else {
        res.sendFile(path.join(__dirname, '../public/login.html'));
    }
});

router.post('/userLogin', async (req, res) => {
    // Handle the login form submission here
    const { email, password } = req.body;
    const emailAddress = email.replace(/\./g, '\\.').replace(/\@/g, '\\@');
    const searchResults = await redis.performSearch(redis.getKeyName('usersidx'), `@email:{${emailAddress}}`, 'RETURN', '1', 'password');
    if (searchResults.length!=0) {
        const [,, passwordResult] = searchResults;
        const passwordCorrect = password === passwordResult[1];
        //console.log(passwordCorrect);
        if (passwordCorrect) {
            console.log(`Successful login for ${email}.`);
            req.session.userId = searchResults[1].split(':')[2];
            //console.log(req.session.userId);
            res.redirect("/userDashboard");
        } else {
            res.redirect('/userLogin?alert=InvalidCredentials');
        }
    } else {
        res.redirect("/userLogin?alert=EmailNotFound");
    }
});

/* Signup route
router.get('/userSignup', (req, res) => {
    // Render the signup page here
    if (req.session.userId) {
        res.redirect('/userDashboard');
    } else {
        res.sendFile(path.join(__dirname, '../public/signup.html'));
    }
});*/

router.post('/userSignup', async (req, res) => {
    // Handle the signup form submission here
    const { firstName, lastName, email, password } = req.body;
    console.log(firstName,'/n',lastName);
    // Get a line to do ID assignment;
    // Could use search functionality instead of counting or maintain a variable in Redis database also
    // Also, add a search functionality to check if the email already exists
    // Add the search if-else block also
    const id = await redis.countMatchingHashes('myApp:users') + 1; // O(N) time complexity operation
    console.log(id);
    let newUser = new UserObj(id, firstName, lastName, email, password); 

    const pipeline = redisClient.pipeline();
    pipeline.hmset(redis.getKeyName('users', id), 'id', newUser);
    const responses=await pipeline.exec();
    const errorCount = await responses.filter((response) => response[0] !== null).length;
    if (!errorCount) {
        console.log(`User ${id} successfully signed up!`);
        req.session.userId = id; // Store user ID in session
        console.log(id);
        res.redirect('/userDashboard');
    } else {
        console.log('Error signing up.');
        res.redirect('/userSignup?alert=ErrorSigningUp.TryAgain.');
    }
});

router.get('/userLogout', (req, res) => {
    if (req.session.userId) {
        req.session.destroy(); // Destroy the session
        console.log("Logged Out successfully");
        res.redirect('/userLogin');
    } else {
        res.sendFile(path.join(__dirname, '../public/error.html'));
    }
});

router.get('/updateUserDetails', async(req, res) => {
    if (req.session.userId) {
        const id = req.session.userId;
        const user = await redisClient.hgetall(redis.getKeyName('users', id));
        delete user.password;
        res.render(path.join(__dirname, '../public/views/updateuserdetail'),{userDetails: user});
    } else {
        res.sendFile(path.join(__dirname, '../public/error.html'));
    }
});

router.post('/updateUserDetails', async (req, res) => {
    if (req.session.userId) {
        const { firstname, lastname, password } = req.body;
        const userId = req.session.userId;
        if (firstname == '' && lastname == '' && password == '') {
            res.redirect('/updateUserDetails');
        }else{
            const pipeline = redisClient.pipeline();
            if(firstname){
                pipeline.hset(redis.getKeyName('users', userId), 'firstname', firstname);
            }
            if(lastname){
                pipeline.hset(redis.getKeyName('users', userId), 'lastname', lastname);
            }
            if(password){
                pipeline.hset(redis.getKeyName('users', userId), 'password', password);
            }
            const responses = await pipeline.exec();

            const errorCount = responses.filter((response) => response[0] !== null).length;
            if (!errorCount) {
                console.log(`User ${userId} details updated successfully!`);
                res.redirect('/userDashboard');
            } else {
                console.log(`Error updating details for user ${userId}.`);
                res.redirect('/updateUserDetails?alert=ErrorUpdatingDetails.TryAgain.');
            }
        }
    } else {
        res.sendFile(path.join(__dirname, '../public/error.html'));
    }
});

router.get('/userDashboard', async (req, res) => {
    if (req.session.userId) {
        //category search
        try {
            const id = req.session.userId;
            let userDetail = await redisClient.hgetall(redis.getKeyName('users', id));
            delete userDetail.password;
            let query = [];
            let isSearch = false;
            if (Object.keys(req.query).length === 0) {
                query = ['*'];
            } else {
                let { name, category, place, stars } = req.query;
                name = decodeURIComponent(name);
                place = decodeURIComponent(place);
                if (name) {
                    query.push(`@name:{${name.toLowerCase()}}`);
                }
                if (category) {
                    query.push(`@category:{${category.toLowerCase()}}`);
                }
                if (place) {
                    query.push(`@location:{${place.toLowerCase()}}`);
                }
                if (stars) {
                    query.push(`@avgRating:[${stars} +inf]`);
                }
                if(query.length==0){
                    query.push('*');
                }
                isSearch=true;
            }
            console.log(query);
            let searchResults = await redis.performSearch(redis.getKeyName('locationsidx'), ...query);
            searchResults=redis.searchResultsConverter(searchResults);
            //console.log(JSON.parse(searchResults));
            let category= new Set();
            searchResults.forEach(location => {
                category.add(location.category);
            });
            //console.log(category);
            res.render(path.join(__dirname, '../public/views/userDashboard.ejs'), { displaySearch: isSearch, categoryList:category ,userDetails: userDetail, searchResults: searchResults});
        } catch (error) {
            console.error('Error performing search:', error);
            res.render(path.join(__dirname, '../public/views/userDashboard.ejs'), { searchResults: [] });
        }
    } else {
        res.redirect('/userLogin');
    }
});

router.get('/location/:locationId', async(req,res) => {
    const locationId = req.params.locationId;
    const pipeline = redisClient.pipeline();
    pipeline.hgetall(redis.getKeyName('users',req.session.userId));
    pipeline.hgetall(redis.getKeyName('locations',locationId));
    pipeline.call('JSON.GET', redis.getKeyName('locationdetails', locationId));
    const response = await pipeline.exec();
    //console.log(response);
    let userDetails = response[0][1];
    delete userDetails.password;
    let location1 = response[1][1];
    let location2 = JSON.parse(response[2][1]);
    res.render(path.join(__dirname,'../public/views/locationPage'),{userDetails:userDetails,location:location1,locationDetails:location2});
});

router.post('/rateLocation/:id', async(req,res) => {
    // Add rating logic here
    const { locationId,rating } = req.body;
    const id = req.session.userId;
    let newRating = new RatingObj(id,locationId,rating);
    let numStars = redisClient.hget(redis.getKeyName('locations',locationId),numStars);
    let numRating = redisClient.hget(redis.getKeyName('locations',locationId),numRating);
    const pipeline = redisClient.pipeline();
    pipeline.hmset(redis.getKeyName('ratings',newRating.id),newRating);
    //update location rating
    pipeline.hincrby(redis.getKeyName('locations',locationId),'numStars',rating);
    pipeline.hincrby(redis.getKeyName('locations',locationId),'numRating',1);
    pipeline.hset(redis.getKeyName('locations',locationId),'avgRating',(numStars+rating)/(numRating+1));
    const responses = await pipeline.exec();
    const errorCount = responses.filter((response) => response[0] !== null).length;
    if (!errorCount) {
        console.log(`user rating ${id} saved successfully added!`);
        //res.redirect('');
    } else {
        console.log('Error saving the details.');
        //res.redirect('');
    }
});
/*
router.post('/search', async (req,res) => {
    //Add search logic here
    const {name,category,location,minStars} = req.body;
    let query = [];
    if (name) {
        query.push(`@name:{${name.toLowerCase()}}`);
    }
    if (category) {
        query.push(`@category:{${category.toLowerCase()}}`);
    }
    if (location) {
        query.push(`@location:{${location.toLowerCase()}}`);
    }
    if (minStars) {
        query.push(`@stars:[${minStars} +inf]`);
    }
    const searchResults = await redis.performSearch(redis.getKeyName('locationsidx'), ...query);
    //perform searcResult object filtering here.
    res.send(searchResults);
});*/

router.get('/userRatings', async(req,res) => {
    if(req.session.userId){
        const id = req.session.userId;
        const user = await redisClient.hgetall(redis.getKeyName('users', id));
        delete user.password;
        let query = [`@userId:{${id}}`];
        let searchResults = await redis.performSearch(redis.getKeyName('ratingsidx'), query);
        searchResults=redis.searchResultsConverter(searchResults);
        for (const rating of searchResults) {
            const locationId = rating.locationId;
            const locationName = await redisClient.hget(redis.getKeyName('locations', locationId), 'name');
            const locationCategory = await redisClient.hget(redis.getKeyName('locations', locationId), 'category');
            const locationLocation = await redisClient.hget(redis.getKeyName('locations',locationId),'location');
            rating.locationName = locationName;
            rating.locationCategory = locationCategory;
            rating.locationLocation = locationLocation;
        }
        res.render(path.join(__dirname,'../public/views/userRating'),{userDetails:user,userRatings:searchResults});
    }
    else{
        res.sendFile(path.join(__dirname, '../public/error.html'));
    }
});

module.exports = router;