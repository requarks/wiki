class BaseError extends Error {
  constructor (message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

class AuthGenericError extends BaseError { constructor (message = 'An unexpected error occured during login.') { super(message) } }
class AuthLoginFailed extends BaseError { constructor (message = 'Invalid email / username or password.') { super(message) } }
class AuthProviderInvalid extends BaseError { constructor (message = 'Invalid authentication provider.') { super(message) } }
class AuthTFAFailed extends BaseError { constructor (message = 'Incorrect TFA Security Code.') { super(message) } }
class AuthTFAInvalid extends BaseError { constructor (message = 'Invalid TFA Security Code or Login Token.') { super(message) } }
class BruteInstanceIsInvalid extends BaseError { constructor (message = 'Invalid Brute Force Instance.') { super(message) } }
class BruteTooManyAttempts extends BaseError { constructor (message = 'Too many attempts! Try again later.') { super(message) } }
class LocaleInvalidNamespace extends BaseError { constructor (message = 'Invalid locale or namespace.') { super(message) } }
class UserCreationFailed extends BaseError { constructor (message = 'An unexpected error occured during user creation.') { super(message) } }

module.exports = {
  BaseError,
  AuthGenericError,
  AuthLoginFailed,
  AuthProviderInvalid,
  AuthTFAFailed,
  AuthTFAInvalid,
  BruteInstanceIsInvalid,
  BruteTooManyAttempts,
  LocaleInvalidNamespace,
  UserCreationFailed
}
