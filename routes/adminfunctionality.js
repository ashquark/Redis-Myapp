const express = require('express');
const router = express.Router();
const path = require("path");

const redis = require('../utils/redisclient');
const redisClient = redis.getClient();

const { LocationObj, LocationDetailsObj } = require("../utils/dataloader");
const { count } = require('console');
// Import the adminDetails object from the adminDetails.json file
const adminDetails = require("../public/Data/adminDetails.json");

router.get('/adminLogin', (req, res) => {
    // Render the login page here
    if(!req.session.isAdminLoggedIn){
        res.sendFile(path.join(__dirname, '../public/adminLogin.html'));
    }else{
        res.redirect('/adminDashboard');
    }
});

router.post('/adminLogin', async (req, res) => {
    // Handle the login form submission here
    const { email, password } = req.body;

    // Verify if the provided email and password match the admin details
    if (email === adminDetails.email && password === adminDetails.password) {
        console.log("Login successful");
        req.session.isAdminLoggedIn = true;
        req.session.adminEmail = email;
        res.redirect("/adminDashboard");
    } else {
        console.log("Invalid login credentials");
        res.redirect("/adminLogin?alert=InvalidCredentials");
    }
});

router.get('/adminLogout', (req, res) => {
    // Clear the session storage details for admin
    req.session.isAdminLoggedIn = false;
    req.session.adminEmail = null;
    req.session.destroy();
    res.redirect("/adminLogin");
});

router.get('/adminDashboard',async(req,res)=>{
    if(req.session.isAdminLoggedIn){
        res.render(path.join(__dirname, '../public/views/adminDashboard.ejs'));
    }
    else{
        res.sendFile(path.join(__dirname,'../public/error.html'));
    }
});

router.get('/addLocation',(req,res)=>{
    res.sendFile(path.join(__dirname,'../public/addNewLocation.html'));
});

router.post('/addLocation',async (req,res)=>{
    if(req.session.isAdminLoggedIn){
        const {name,category,location,numStars,numRating,hrmon,hrtue,hrwed,hrthu,hrfri,hrsat,hrsun,instagram,facebook,twitter,website,description,phone} = req.body;
        const hours = [
            { day: 'monday', hours: hrmon },
            { day: 'tuesday', hours: hrtue },
            { day: 'wednesday', hours: hrwed },
            { day: 'thursday', hours: hrthu },
            { day: 'friday', hours: hrfri },
            { day: 'saturday', hours: hrsat },
            { day: 'sunday', hours: hrsun }
        ];
        const socials = [
            {'instagram':instagram.toLowerCase()},
            {'facebook':facebook.toLowerCase()},
            {'twitter':twitter.toLowerCase()}
        ];
        const id = parseInt(await redisClient.get('myApp:locationCount')) + 1; 
        let newLocation = new LocationObj(id,name,category,location,numStars,numRating);
        let newLocationDetails = new LocationDetailsObj(id,hours,socials,website,description,phone);
        const pipeline = redisClient.pipeline();
        pipeline.hmset(redis.getKeyName('locations', id), newLocation);
        pipeline.call('JSON.SET', redis.getKeyName('locationdetails', newLocationDetails.id), '.', JSON.stringify(newLocationDetails));
        const responses = await pipeline.exec();
        const errorCount = responses.filter((response) => response[0] !== null).length;
        if (!errorCount) {
            console.log(`Location ${id} successfully added!`);
            await redisClient.incrby('myApp:locationCount',1);
            res.redirect('/adminDashboard');
        } else {
            console.log('Error saving the details.');
            res.redirect('/addLocation?alert=ErrorSavingDetails!');
        }
    }else{
        res.sendFile(path.join(__dirname,'../public/error.html')); 
    }
});

router.get('/locationList', async (req, res) => {
    let searchResults = await redis.performSearch(redis.getKeyName('locationsidx'), '*');
    searchResults=redis.searchResultsConverter(searchResults); 
    res.json({ searchResults: searchResults });
});  

router.get('/updateLocation/:id',async(req,res)=>{
    if(req.session.isAdminLoggedIn){
        res.render(path.join(__dirname, '../public/views/updateLocation'),{id:req.params.id});
    }else{
        res.sendFile(path.join(__dirname,'../public/error.html'));
    }
});

router.post('/updateLocation/:id',async(req,res)=>{
    if(req.session.isAdminLoggedIn){
        //add the update logic here.
        const id = req.params.id
        const {name,category,location,numStars,numRating,hrmon,hrtue,hrwed,hrthu,hrfri,hrsat,hrsun,instagram,facebook,twitter,website,description,phone} = req.body;
        const locationDetails = await redisClient.call('JSON.GET',redis.getKeyName('locationdetails', id));
        let parsedLocationDetails = JSON.parse(locationDetails);
        if(parsedLocationDetails){
            if(parsedLocationDetails.hours){
                if(hrmon){
                    parsedLocationDetails.hours[0].hours=hrmon;
                }
                if(hrtue){
                    parsedLocationDetails.hours[1].hours=hrtue;
                }
                if(hrwed){
                    parsedLocationDetails.hours[2].hours=hrwed;
                }
                if(hrthu){
                    parsedLocationDetails.hours[3].hours=hrthu;
                }
                if(hrfri){
                    parsedLocationDetails.hours[4].hours=hrfri;
                }
                if(hrsat){
                    parsedLocationDetails.hours[5].hours=hrsat;
                }
                if(hrsun){
                    parsedLocationDetails.hours[6].hours=hrsun;
                }
            }else{
                const hours = [
                    { day: 'monday', hours: hrmon },
                    { day: 'tuesday', hours: hrtue },
                    { day: 'wednesday', hours: hrwed },
                    { day: 'thursday', hours: hrthu },
                    { day: 'friday', hours: hrfri },
                    { day: 'saturday', hours: hrsat },
                    { day: 'sunday', hours: hrsun }
                ];
                parsedLocationDetails.hours=hours;
            }
            if(instagram){
                parsedLocationDetails.socials[0].instagram=instagram.toLowerCase();
            }
            if(facebook){
                parsedLocationDetails.socials[1].facebook=facebook.toLowerCase();
            }
            if(twitter){
                parsedLocationDetails.socials[2].twitter=twitter.toLowerCase();
            }
            if(website){
                parsedLocationDetails.website=website.toLowerCase();
            } 
            if(description){
                parsedLocationDetails.description=description.toLowerCase();
            }
            if(phone){
                parsedLocationDetails.phone=phone;
            }
        }else{
            const hours = [
                { day: 'monday', hours: hrmon },
                { day: 'tuesday', hours: hrtue },
                { day: 'wednesday', hours: hrwed },
                { day: 'thursday', hours: hrthu },
                { day: 'friday', hours: hrfri },
                { day: 'saturday', hours: hrsat },
                { day: 'sunday', hours: hrsun }
            ];
            const socials = [
                {'instagram':instagram},
                {'facebook':facebook},
                {'twitter':twitter}
            ];
            parsedLocationDetails = new LocationDetailsObj(id,hours,socials,website,description,phone);
        }
        const pipeline = redisClient.pipeline();
        if(name){
            pipeline.hset(redis.getKeyName('locations',id),'name',name);
        }
        if(category){
            pipeline.hset(redis.getKeyName('locations',id),'category',category);
        }
        if(location){
            pipeline.hset(redis.getKeyName('locations',id),'location',location);
        }
        if(numStars){
            pipeline.hset(redis.getKeyName('locations',id),'numStars',numStars);
        }
        if(numRating){
            pipeline.hset(redis.getKeyName('locations',id),'numRating',numRating);
        }
        if(hrmon||hrtue||hrwed||hrthu||hrfri||hrsat||hrsun||instagram||facebook||twitter||website||description||phone){
            pipeline.call('JSON.SET', redis.getKeyName('locationdetails', id), '.', JSON.stringify(parsedLocationDetails));
        }
        const responses = await pipeline.exec();
        const errorCount = responses.filter((response) => response[0] !== null).length;
        if (!errorCount) {
            console.log(`Location ${id} successfully updated!`);
            res.redirect('/adminDashboard');
        } else {
            console.log('Error saving the details.');
            res.redirect('/updateLocation?alert=ErrorSavingDetails!');
        }
    }else{
        res.sendFile(path.join(__dirname,'../public/error.html'));
    }
});
router.delete('/deleteLocation/:id',async(req,res)=>{
    if(req.session.isAdminLoggedIn){
        //add the delete logic here
        const id = req.params.id;
        //get ratings for that location
        let query = [`@locationId:{${id}}`];
        const locationRatings = await redis.performSearch(redis.getKeyName('ratingsidx'), query);
        const results=[];
        for(let i=1;i<locationRatings.length;i+=2){
            results.push(locationRatings[i]);
        }
        const pipeline = redisClient.pipeline();
        pipeline.del(redis.getKeyName('locations',id),redis.getKeyName('locationdetails',id));
        if(results.length){
            pipeline.del(...results);
        }
        await pipeline.exec(); 
        res.sendStatus(200);
    }else{
        res.sendFile(path.join(__dirname,'../public/error.html'));
    }
});

module.exports = router;