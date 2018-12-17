const CustomError = require('custom-error-instance')

module.exports = {
  AuthGenericError: CustomError('AuthGenericError', {
    message: 'An unexpected error occured during login.',
    code: 1001
  }),
  AuthLoginFailed: CustomError('AuthLoginFailed', {
    message: 'Invalid email / username or password.',
    code: 1002
  }),
  AuthProviderInvalid: CustomError('AuthProviderInvalid', {
    message: 'Invalid authentication provider.',
    code: 1003
  }),
  AuthAccountAlreadyExists: CustomError('AuthAccountAlreadyExists', {
    message: 'An account already exists using this email address.',
    code: 1004
  }),
  AuthTFAFailed: CustomError('AuthTFAFailed', {
    message: 'Incorrect TFA Security Code.',
    code: 1005
  }),
  AuthTFAInvalid: CustomError('AuthTFAInvalid', {
    message: 'Invalid TFA Security Code or Login Token.',
    code: 1006
  }),
  BruteInstanceIsInvalid: CustomError('BruteInstanceIsInvalid', {
    message: 'Invalid Brute Force Instance.',
    code: 1007
  }),
  BruteTooManyAttempts: CustomError('BruteTooManyAttempts', {
    message: 'Too many attempts! Try again later.',
    code: 1008
  }),
  LocaleInvalidNamespace: CustomError('LocaleInvalidNamespace', {
    message: 'Invalid locale or namespace.',
    code: 1009
  }),
  UserCreationFailed: CustomError('UserCreationFailed', {
    message: 'An unexpected error occured during user creation.',
    code: 1010
  })
}
