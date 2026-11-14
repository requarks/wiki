-- The site's cookie consent banner: whether readers are shown one, and what it says. Off, as it is
-- for a new site -- the wiki itself sets only the session cookie, which is strictly necessary and
-- needs no consent, so a banner is something an administrator turns on when the site's analytics
-- providers call for it. The message is the predefined one a new site starts with, so that turning
-- the banner on shows something sensible before anybody has written their own.
--
-- A data migration because a site's settings are read back from the `config` JSONB column verbatim,
-- so a key added in the code is missing from every site that already exists.
--
-- Only where the key is absent, so that running it again changes nothing.
UPDATE "sites"
SET "config" = jsonb_set(
		"config",
		'{cookieConsent}',
		'{"isEnabled":false,"message":"This site uses cookies that are strictly necessary for it to work, such as the one keeping you signed in. Any other cookie, such as one measuring how the site is used, is only set with your consent."}'::jsonb,
		true
	)
WHERE "config" -> 'cookieConsent' IS NULL;
