## How to use

* `yarn install`

```
Usage: node index.js command [limit] [dbProperties]

command can be:
meta - retrieves extensions meta data and saves to 'data/extensions.json'
download - downloads all the extensions in 'data/extensions.json' to data/extensions/*
analyse - analyse the downloaded extensions
database - fills a postgresql database with parsed & downloaded data

For the `download` command you can also pass an optional `limit` parameter.
It controls the minimum downloads extension should have in order to be downloaded.
Default value is 10000.

For the `database` command you can also pass database properties
dbProperties=host port database user password
```

## Setup puppetteer on Debian

```
apt-get install -y wget
apt-get install -y gconf-service
apt-get install -y libasound2
apt-get install -y libatk1.0-0
apt-get install -y libc6
apt-get install -y libcairo2
apt-get install -y libcups2
apt-get install -y libdbus-1-3
apt-get install -y libexpat1
apt-get install -y libfontconfig1
apt-get install -y libgcc1
apt-get install -y libgconf-2-4
apt-get install -y libgdk-pixbuf2.0-0
apt-get install -y libglib2.0-0
apt-get install -y libgtk-3-0
apt-get install -y libnspr4
apt-get install -y libpango-1.0-0
apt-get install -y libpangocairo-1.0-0
apt-get install -y libstdc++6
apt-get install -y libx11-6
apt-get install -y libx11-xcb1
apt-get install -y libxcb1
apt-get install -y libxcomposite1
apt-get install -y libxcursor1
apt-get install -y libxdamage1
apt-get install -y libxext6
apt-get install -y libxfixes3
apt-get install -y libxi6
apt-get install -y libxrandr2
apt-get install -y libxrender1
apt-get install -y libxss1
apt-get install -y libxtst6
apt-get install -y ca-certificates
apt-get install -y fonts-liberation
apt-get install -y libappindicator1
apt-get install -y libnss3
apt-get install -y lsb-release
apt-get install -y xdg-utils
```