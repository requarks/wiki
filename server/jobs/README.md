# About jobs

The files in this directory can be executed manually from the terminal like this:

````bash
node server/core/worker.js --job=send-comment-notification-emails
````

To trigger a job on schedule automatically, you need to add an entry to the file `server/app/data.yml` under the `jobs`
key. For the `schedule` values, refer to [ISO 8601 durations](https://en.wikipedia.org/wiki/ISO_8601#Durations).
