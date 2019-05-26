const CustomError = require('custom-error-instance')

module.exports = {
  AssetDeleteForbidden: CustomError('AssetDeleteForbidden', {
    message: 'You are not authorized to delete this asset.',
    code: 2003
  }),
  AssetFolderExists: CustomError('AssetFolderExists', {
    message: 'An asset folder with the same name already exists.',
    code: 2002
  }),
  AssetGenericError: CustomError('AssetGenericError', {
    message: 'An unexpected error occured during asset change.',
    code: 2001
  }),
  AssetInvalid: CustomError('AssetInvalid', {
    message: 'This asset does not exist or is invalid.',
    code: 2004
  }),
  AssetRenameCollision: CustomError('AssetRenameCollision', {
    message: 'An asset with the same filename in the same folder already exists.',
    code: 2005
  }),
  AssetRenameForbidden: CustomError('AssetRenameForbidden', {
    message: 'You are not authorized to rename this asset.',
    code: 2006
  }),
  AssetRenameInvalid: CustomError('AssetRenameInvalid', {
    message: 'The new asset filename is invalid.',
    code: 2007
  }),
  AssetRenameInvalidExt: CustomError('AssetRenameInvalidExt', {
    message: 'The file extension cannot be changed on an existing asset.',
    code: 2008
  }),
  AssetRenameTargetForbidden: CustomError('AssetRenameTargetForbidden', {
    message: 'You are not authorized to rename this asset to the requested name.',
    code: 2009
  }),
  AuthAccountBanned: CustomError('AuthAccountBanned', {
    message: 'Your account has been disabled.',
    code: 1016
  }),
  AuthAccountNotVerified: CustomError('AuthAccountNotVerified', {
    message: 'You must verify your account before your can login.',
    code: 1017
  }),
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
  AuthRegistrationDisabled: CustomError('AuthRegistrationDisabled', {
    message: 'Registration is disabled. Contact your system administrator.',
    code: 1011
  }),
  AuthRegistrationDomainUnauthorized: CustomError('AuthRegistrationDomainUnauthorized', {
    message: 'You are not authorized to register. Must use a whitelisted domain.',
    code: 1012
  }),
  AuthTFAFailed: CustomError('AuthTFAFailed', {
    message: 'Incorrect TFA Security Code.',
    code: 1005
  }),
  AuthTFAInvalid: CustomError('AuthTFAInvalid', {
    message: 'Invalid TFA Security Code or Login Token.',
    code: 1006
  }),
  AuthValidationTokenInvalid: CustomError('AuthValidationTokenInvalid', {
    message: 'Invalid validation token.',
    code: 1018
  }),
  BruteInstanceIsInvalid: CustomError('BruteInstanceIsInvalid', {
    message: 'Invalid Brute Force Instance.',
    code: 1007
  }),
  BruteTooManyAttempts: CustomError('BruteTooManyAttempts', {
    message: 'Too many attempts! Try again later.',
    code: 1008
  }),
  InputInvalid: CustomError('InputInvalid', {
    message: 'Input data is invalid.',
    code: 1013
  }),
  MailNotSetup: CustomError('MailNotSetup', {
    message: 'Mail is not setup yet.',
    code: 1014
  }),
  MailTemplateFailed: CustomError('MailTemplateFailed', {
    message: 'Mail template failed to load.',
    code: 1015
  }),
  LocaleInvalidNamespace: CustomError('LocaleInvalidNamespace', {
    message: 'Invalid locale or namespace.',
    code: 1009
  }),
  SearchActivationFailed: CustomError('SearchActivationFailed', {
    message: 'Search Engine activation failed.',
    code: 1019
  }),
  UserCreationFailed: CustomError('UserCreationFailed', {
    message: 'An unexpected error occured during user creation.',
    code: 1010
  })
}
