
class UserObj {
    constructor(id, firstname, lastname, email, password) {
      this.id = id;
      this.firstname = firstname;
      this.lastname = lastname;
      this.email = email;
      this.password = password; 
    }
}
class LocationObj {
    constructor(id, name, category, location, numStars=0, numRating=0) {
      this.id = id;
      this.name = name.toLowerCase();
      this.category = category.toLowerCase();
      this.location = location.toLowerCase();
      this.numStars = numStars;
      this.numRating = numRating;
      const str="Not enough rating";
      this.avgRating = (numRating>=1)?(numStars/numRating):(str);
    }
}

class LocationDetailsObj {
    constructor(id, hours, socials, website, description, phone) {
      this.id = id;
      this.hours=hours;
      this.socials = socials;
      this.website = website.toLowerCase();
      this.description = description.toLowerCase();
      this.phone = phone;
    }
}

class RatingObj{
  constructor(userId, locationId, rating){
    this.id = userId+'-'+locationId;
    this.userId = userId;
    this.locationId = locationId;
    this.rating = rating;  
  }
}

module.exports = {
  UserObj,
  LocationObj,
  LocationDetailsObj,
  RatingObj
};