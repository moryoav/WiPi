# WiPi - Unofficial RaspAP Helper App

**TL;DR** – A React Native + Expo Android app that lets you add a Raspberry Pi running RaspAP, browse nearby Wi-Fi networks, and switch the Pi’s upstream connection in one tap. No SSH terminal gymnastics, no laptop required.

---

## ✨ Motivation
Running **RaspAP** is brilliant for traveling — but changing the Pi’s **upstream Wi-Fi** still means:
1. Opening the browser
2. Going into the RaspAp dashboard and signing in.
3. Going into the network menu and searching for a network.

**This companion app is almost useless as you can do anything in the RaspAp dashboard, but the app makes this process only slightly faster** 

With this app you'll get a modern mobile UI that:

* discovers or adds a Pi by hostname/IP,
* lists visible networks with signal + security details,
* connects / disconnects with a single press,
* shows real-time status of each AP interface,
* works even when the Pi has no Internet access.

---

## 🚀 Under the hood
Under the hood we reuse the Pi’s existing SSH stack: the app executes minimal, idempotent shell commands (`wpa_cli`, `systemctl status hostapd@wlan1`, etc.) so it never corrupts RaspAP’s files.
The app saves the SSH credentials in secure device storage.

---

## Getting Started
install React Native Expo
Clone the project 
expo start

---
### Minimum Requirements
Android 8.0, Expo SDK 50, Any device with SSH enabled.

---
### Contributing
Issues and PRs are welcome—please open an issue first if you plan a large change.
All code is released under the MIT License (see LICENSE).

---
### License
MIT – do whatever you want, just keep the copyright and license notice.