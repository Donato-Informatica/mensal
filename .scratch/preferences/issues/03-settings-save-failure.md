# 03: A failed save in Configurações says so

**Parent:** 01 (Account-wide preferences)

**What to build:** when saving a preference from the Configurações modal fails, the user sees it: the switch flips back to its old value and a red `Alert` (`variant="light"`) above the switches says **"Alteração não salva."** followed by `errorMessage(error)`, as the other modals do.

**Blocked by:** 02 (Preferences travel with the account)

**Status:** ready-for-agent

- [x] A failed save in the modal flips the switch back and shows the `Alert` above the switches with "Alteração não salva." and the error's message.
- [x] A later successful save clears the `Alert`.
- [x] The fake API can make `update-user` fail, without mocking anything but the network.
- [x] Web test covering the failure state above.
- [x] `npm run check` green.
