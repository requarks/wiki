var LocalStrategy = require('passport-local').Strategy;

module.exports = function(passport, appconfig) {

    // Serialization user methods

    passport.serializeUser(function(user, done) {
        done(null, user._id);
    });

    passport.deserializeUser(function(id, done) {
        db.User.findById(id).then((user) => {
            done(null, user);
        }).catch((err) => {
            done(err, null);
        });
    });

    // Setup local user authentication strategy

    passport.use(
        'local',
        new LocalStrategy({
            usernameField : 'email',
            passwordField : 'password',
            passReqToCallback : true
        },
        function(req, uEmail, uPassword, done) {
            db.User.findOne({ 'email' :  uEmail }).then((user) => {
                if (user) {
                    user.validatePassword(uPassword).then((isValid) => {
                        return (isValid) ? done(null, user) : done(null, false);
                    });
                } else {
                    return done(null, false);
                }
            }).catch((err) => {
                done(err);
            });
        })
    );

    // Check for admin access

    db.connectPromise.then(() => {

        db.User.count().then((count) => {
            if(count < 1) {
                winston.info('No administrator account found. Creating a new one...');
                db.User.new({
                    email: appconfig.admin,
                    firstName: "Admin",
                    lastName: "Admin",
                    password: "admin123"
                }).then(() => {
                    winston.info('Administrator account created successfully!');
                }).catch((ex) => {
                    winston.error('An error occured while creating administrator account: ' + ex);
                });
            }
        });

    });

};