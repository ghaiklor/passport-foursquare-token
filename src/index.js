import { OAuth2Strategy, InternalOAuthError } from 'passport-oauth';

/**
 * `Strategy` constructor.
 * The Foursquare authentication strategy authenticates requests by delegating to Foursquare using OAuth2 access tokens.
 * Applications must supply a `verify` callback which accepts a accessToken, refreshToken, profile and callback.
 * Callback supplying a `user`, which should be set to `false` if the credentials are not valid.
 * If an exception occurs, `error` should be set.
 *
 * Options:
 * - clientID          Identifies client to Foursquare App
 * - clientSecret      Secret used to establish ownership of the consumer key
 * - passReqToCallback If need, pass req to verify callback
 *
 * @param {Object} _options
 * @param {Function} _verify
 * @example
 * passport.use(new FoursquareTokenStrategy({
 *   clientID: '123456789',
 *   clientSecret: 'shhh-its-a-secret'
 * }), function(accessToken, refreshToken, profile, next) {
 *   User.findOrCreate({foursquareId: profile.id}, function(error, user) {
 *     next(error, user);
 *   })
 * })
 */
export default class FoursquareTokenStrategy extends OAuth2Strategy {
  constructor(_options, _verify) {
    let options = _options || {};
    let verify = _verify;

    options.authorizationURL = options.authorizationURL || 'https://foursquare.com/oauth2/authenticate';
    options.tokenURL = options.tokenURL || 'https://foursquare.com/oauth2/access_token';

    super(options, verify);

    this.name = 'foursquare-token';
    this._accessTokenField = options.accessTokenField || 'access_token';
    this._refreshTokenField = options.refreshTokenField || 'refresh_token';
    this._profileURL = options.profileURL || 'https://api.foursquare.com/v2/users/self';
    this._apiVersion = options.apiVersion || '20140308';
    this._passReqToCallback = options.passReqToCallback;

    this._oauth2.setAccessTokenName("oauth_token");
  }

  /**
   * Authenticate method
   * @param {Object} req
   * @param {Object} options
   * @returns {*}
   */
  authenticate(req, options) {
    let accessToken = (req.body && req.body[this._accessTokenField]) || (req.query && req.query[this._accessTokenField]);
    let refreshToken = (req.body && req.body[this._refreshTokenField]) || (req.query && req.query[this._refreshTokenField]);

    if (!accessToken) return this.fail({message: `You should provide ${this._accessTokenField}`});

    this._loadUserProfile(accessToken, (error, profile) => {
      if (error) return this.error(error);

      const verified = (error, user, info) => {
        if (error) return this.error(error);
        if (!user) return this.fail(info);

        return this.success(user, info);
      };

      if (this._passReqToCallback) {
        this._verify(req, accessToken, refreshToken, profile, verified);
      } else {
        this._verify(accessToken, refreshToken, profile, verified);
      }
    });
  }

  /**
   * Parse user profile
   * @param {String} accessToken Foursquare OAuth2 access token
   * @param {Function} done
   */
  userProfile(accessToken, done) {
    let url = this._apiVersion ? (this._profileURL + '?v=' + this._apiVersion) : this._profileURL;

    this._oauth2.get(url, accessToken, (error, body, res) => {
      if (error) {
        try {
          let errorJSON = JSON.parse(error.data);
          return done(new InternalOAuthError(errorJSON.meta.errorDetail, errorJSON.meta.code));
        } catch (_) {
          return done(new InternalOAuthError('Failed to fetch user profile', error));
        }
      }

      try {
        let json = JSON.parse(body);
        json['id'] = json.response.user.id;

        let profile = {
          provider: 'foursquare',
          id: json.id,
          displayName: json.response.user.firstName + ' ' + json.response.user.lastName,
          name: {
            familyName: json.response.user.lastName || '',
            givenName: json.response.user.firstName || ''
          },
          emails: [{value: json.response.user.contact.email}],
          photos: [{value: json.response.user.photo}],
          _raw: body,
          _json: json
        };

        return done(null, profile);
      } catch (e) {
        return done(e);
      }
    });
  }
}
