# Vault V2
> This is the upgraded version of [Self Hosted CDN](https://github.com/arpan-mandal/self-hosted-cdn).

A lightweight self-hosted cloud storage web app built with Node.js.

It is designed to be simple to deploy, especially on Pterodactyl. Clone or fork the repository, start the server, and the required runtime folders and configuration are created automatically.

## Features

* Upload and download files
* Folder support
* Public file sharing
* File deletion and management
* User authentication
* Sub-user support
* Storage quota handling
* Custom upload size limit
* Responsive web interface
* Custom 404 page
* Automatic first-run setup
* Pterodactyl-friendly port handling
* Persistent local storage
* No external database required

## Requirements

* Node.js
* npm

Node.js 20 or newer is recommended.

## Installation

Clone the repository:

```bash
git clone github.com/arpan-mandal/vault-v2
cd vault-v2
```

Install dependencies:

```bash
npm install
```

Start the server:

```bash
node server.js
```

On the first start, the application automatically creates its `.env` file and required runtime directories.

## First Login

The default credentials are:

```text
Username: admin
Password: changeme
```

Change these immediately after the first startup.

Open:

```text
.env
```

and update:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
```

Restart the server after making changes.

A random session secret is generated automatically during the first startup and stored in `.env`. It is reused on future restarts.

## Configuration

The generated `.env` contains the main application settings.

Example:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
SESSION_SECRET=generated-automatically
MAX_FILE_SIZE=5368709120
PORT=3000
```

### Upload Size

`MAX_FILE_SIZE` is specified in bytes.

The default is 5 GiB:

```env
MAX_FILE_SIZE=5368709120
```

### Port

When running normally, the application uses:

```env
PORT=3000
```

When deployed through Pterodactyl, `SERVER_PORT` is detected automatically from the instance and takes priority.

## Pterodactyl

Set the main file to:

```text
server.js
```

A simple startup command is:

```bash
if [[ -d .git ]] && [[ "${AUTO_UPDATE}" == "1" ]]; then git pull; fi; if [[ -n "${NODE_PACKAGES}" ]]; then /usr/local/bin/npm install --loglevel=error ${NODE_PACKAGES}; fi; if [[ -n "${UNNODE_PACKAGES}" ]]; then /usr/local/bin/npm uninstall --loglevel=error ${UNNODE_PACKAGES}; fi; if [[ -f /home/container/package.json ]]; then /usr/local/bin/npm install --loglevel=error; fi; printf '\033[2J\033[H'; /usr/local/bin/node "/home/container/${MAIN_FILE}" ${NODE_ARGS}
```

The application automatically creates its runtime directories when they do not exist.

## Runtime Files

The application creates and uses directories such as:

```text
uploads/
temp/
data/
```

These contain user files and application state and should be treated as persistent data.

The `.env` file also contains private configuration and should not be made public.

## Reverse Proxy

The application can be used behind Nginx, Nginx Proxy Manager, Caddy, Cloudflare, or another reverse proxy.

If large uploads are enabled, make sure the proxy also allows the required request size. A proxy-side upload limit can reject a file before it reaches the Node.js application.

## Updating

If the installation was cloned using Git:

```bash
git pull
npm install
```

Then restart the application.

For Pterodactyl installations, automatic Git updates can also be handled through the startup command using the `AUTO_UPDATE` variable.

## Data

The application uses local files for storage and application state.

Make backups of the following before reinstalling or moving the server:

```text
uploads/
data/
.env
```

## Security

After installation:

* Change the default admin username and password.
* Keep `.env` private.
* Use HTTPS when exposing the application publicly.


## License

This project is distributed under the Vertos Attribution License 1.0.

See the `LICENSE` file for the full terms.

Vault branding and attribution included with the software must remain intact as described in the license.
