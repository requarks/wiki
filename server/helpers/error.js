const CustomError = require('custom-error-instance')

module.exports = {
  AssetDeleteForbidden: CustomError('AssetDeleteForbidden', {
    message: 'You are not authorized to delete this asset.'
  }),
  AssetFolderExists: CustomError('AssetFolderExists', {
    message: 'An asset folder with the same name already exists.'
  }),
  AssetGenericError: CustomError('AssetGenericError', {
    message: 'An unexpected error occured during asset operation.'
  }),
  AssetInvalid: CustomError('AssetInvalid', {
    message: 'This asset does not exist or is invalid.'
  }),
  AssetRenameCollision: CustomError('AssetRenameCollision', {
    message: 'An asset with the same filename in the same folder already exists.'
  }),
  AssetRenameForbidden: CustomError('AssetRenameForbidden', {
    message: 'You are not authorized to rename this asset.'
  }),
  AssetRenameInvalid: CustomError('AssetRenameInvalid', {
    message: 'The new asset filename is invalid.'
  }),
  AssetRenameInvalidExt: CustomError('AssetRenameInvalidExt', {
    message: 'The file extension cannot be changed on an existing asset.'
  }),
  AssetRenameTargetForbidden: CustomError('AssetRenameTargetForbidden', {
    message: 'You are not authorized to rename this asset to the requested name.'
  }),
  AuthAccountBanned: CustomError('AuthAccountBanned', {
    message: 'Your account has been disabled.'
  }),
  AuthAccountAlreadyExists: CustomError('AuthAccountAlreadyExists', {
    message: 'An account already exists using this email address.'
  }),
  AuthAccountNotVerified: CustomError('AuthAccountNotVerified', {
    message: 'You must verify your account before your can login.'
  }),
  AuthGenericError: CustomError('AuthGenericError', {
    message: 'An unexpected error occured during login.'
  }),
  AuthLoginFailed: CustomError('AuthLoginFailed', {
    message: 'Invalid email / username or password.'
  }),
  AuthPasswordInvalid: CustomError('AuthPasswordInvalid', {
    message: 'Password is incorrect.'
  }),
  AuthProviderInvalid: CustomError('AuthProviderInvalid', {
    message: 'Invalid authentication provider.'
  }),
  AuthRegistrationDisabled: CustomError('AuthRegistrationDisabled', {
    message: 'Registration is disabled. Contact your system administrator.'
  }),
  AuthRegistrationDomainUnauthorized: CustomError('AuthRegistrationDomainUnauthorized', {
    message: 'You are not authorized to register. Your domain is not whitelisted.'
  }),
  AuthRequired: CustomError('AuthRequired', {
    message: 'You must be authenticated to access this resource.'
  }),
  AuthTFAFailed: CustomError('AuthTFAFailed', {
    message: 'Incorrect TFA Security Code.'
  }),
  AuthTFAInvalid: CustomError('AuthTFAInvalid', {
    message: 'Invalid TFA Security Code or Login Token.'
  }),
  AuthValidationTokenInvalid: CustomError('AuthValidationTokenInvalid', {
    message: 'Invalid validation token.'
  }),
  BruteInstanceIsInvalid: CustomError('BruteInstanceIsInvalid', {
    message: 'Invalid Brute Force Instance.'
  }),
  BruteTooManyAttempts: CustomError('BruteTooManyAttempts', {
    message: 'Too many attempts! Try again later.'
  }),
  CommentContentMissing: CustomError('CommentContentMissing', {
    message: 'Comment content is missing or too short.'
  }),
  CommentGenericError: CustomError('CommentGenericError', {
    message: 'An unexpected error occured.'
  }),
  CommentManageForbidden: CustomError('CommentManageForbidden', {
    message: 'You are not authorized to manage comments on this page.'
  }),
  CommentNotFound: CustomError('CommentNotFound', {
    message: 'This comment does not exist.'
  }),
  CommentPostForbidden: CustomError('CommentPostForbidden', {
    message: 'You are not authorized to post a comment on this page.'
  }),
  CommentViewForbidden: CustomError('CommentViewForbidden', {
    message: 'You are not authorized to view comments for this page.'
  }),
  InputInvalid: CustomError('InputInvalid', {
    message: 'Input data is invalid.'
  }),
  LocaleGenericError: CustomError('LocaleGenericError', {
    message: 'An unexpected error occured during locale operation.'
  }),
  LocaleInvalidNamespace: CustomError('LocaleInvalidNamespace', {
    message: 'Invalid locale or namespace.'
  }),
  MailGenericError: CustomError('MailGenericError', {
    message: 'An unexpected error occured during mail operation.'
  }),
  MailInvalidRecipient: CustomError('MailInvalidRecipient', {
    message: 'The recipient email address is invalid.'
  }),
  MailNotConfigured: CustomError('MailNotConfigured', {
    message: 'The mail configuration is incomplete or invalid.'
  }),
  MailTemplateFailed: CustomError('MailTemplateFailed', {
    message: 'Mail template failed to load.'
  }),
  PageCreateForbidden: CustomError('PageCreateForbidden', {
    message: 'You are not authorized to create this page.'
  }),
  PageDeleteForbidden: CustomError('PageDeleteForbidden', {
    message: 'You are not authorized to delete this page.'
  }),
  PageGenericError: CustomError('PageGenericError', {
    message: 'An unexpected error occured during a page operation.'
  }),
  PageDuplicateCreate: CustomError('PageDuplicateCreate', {
    message: 'Cannot create this page because an entry already exists at the same path.'
  }),
  PageEmptyContent: CustomError('PageEmptyContent', {
    message: 'Page content cannot be empty.'
  }),
  PageHistoryForbidden: CustomError('PageHistoryForbidden', {
    message: 'You are not authorized to view the history of this page.'
  }),
  PageIllegalPath: CustomError('PageIllegalPath', {
    message: 'Page path cannot contains illegal characters.'
  }),
  PageMoveForbidden: CustomError('PageMoveForbidden', {
    message: 'You are not authorized to move this page.'
  }),
  PageNotFound: CustomError('PageNotFound', {
    message: 'This page does not exist.'
  }),
  PagePathCollision: CustomError('PagePathCollision', {
    message: 'Destination page path already exists.'
  }),
  PageRestoreForbidden: CustomError('PageRestoreForbidden', {
    message: 'You are not authorized to restore this page version.'
  }),
  PageUpdateForbidden: CustomError('PageUpdateForbidden', {
    message: 'You are not authorized to update this page.'
  }),
  PageViewForbidden: CustomError('PageViewForbidden', {
    message: 'You are not authorized to view this page.'
  }),
  SearchActivationFailed: CustomError('SearchActivationFailed', {
    message: 'Search Engine activation failed.'
  }),
  SearchGenericError: CustomError('SearchGenericError', {
    message: 'An unexpected error occured during search operation.'
  }),
  SystemGenericError: CustomError('SystemGenericError', {
    message: 'An unexpected error occured.'
  }),
  SystemSSLDisabled: CustomError('SystemSSLDisabled', {
    message: 'SSL is not enabled.'
  }),
  SystemSSLLEUnavailable: CustomError('SystemSSLLEUnavailable', {
    message: 'Let\'s Encrypt is not initialized.'
  }),
  SystemSSLRenewInvalidProvider: CustomError('SystemSSLRenewInvalidProvider', {
    message: 'Current provider does not support SSL certificate renewal.'
  }),
  UserCreationFailed: CustomError('UserCreationFailed', {
    message: 'An unexpected error occured during user creation.'
  }),
  UserDeleteForeignConstraint: CustomError('UserDeleteForeignConstraint', {
    message: 'Cannot delete user because of content relational constraints.'
  }),
  UserDeleteProtected: CustomError('UserDeleteProtected', {
    message: 'Cannot delete a protected system account.'
  }),
  UserNotFound: CustomError('UserNotFound', {
    message: 'This user does not exist.'
  })
}
