import { Avatar, Loader, Menu, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconDownload,
  IconKey,
  IconLock,
  IconLogout,
  IconSettings,
  IconTrash,
  IconUser,
  IconUserEdit,
} from "@tabler/icons-react";
import { AccessTokensModal } from "./access-tokens.tsx";
import classes from "./account-menu.module.css";
import { ChangeNameModal } from "./change-name.tsx";
import { ChangePasswordModal } from "./change-password.tsx";
import { DeleteAccountModal } from "./delete-account.tsx";
import { DataDownloadFailure, useDataDownload } from "./download-data.tsx";
import { useSession } from "./session.ts";
import { SettingsModal } from "./settings.tsx";
import { SignOutModal } from "./sign-out-button.tsx";

/**
 * The header's account menu: an avatar with the user icon, which opens their name and
 * email over Configurações, Alterar nome, Alterar senha, Tokens de acesso,
 * Baixar meus dados, Sair and, last, Excluir conta. Each item opens its
 * modal, but Baixar meus dados, which keeps the menu open with a loader until
 * the archive arrives.
 */
export function AccountMenu() {
  const { name, email } = useSession().user;
  const [menu, menuHandlers] = useDisclosure(false);
  const download = useDataDownload();
  const [settings, settingsHandlers] = useDisclosure(false);
  const [rename, renameHandlers] = useDisclosure(false);
  const [password, passwordHandlers] = useDisclosure(false);
  const [tokens, tokensHandlers] = useDisclosure(false);
  const [signOut, signOutHandlers] = useDisclosure(false);
  const [remove, deleteHandlers] = useDisclosure(false);

  return (
    <>
      <Menu
        position="bottom-end"
        width={260}
        hideDetached={false}
        opened={menu}
        onChange={(opened) =>
          opened ? menuHandlers.open() : menuHandlers.close()
        }
      >
        <Menu.Target>
          <UnstyledButton
            className={classes.trigger}
            aria-label="Conta"
            title="Conta"
          >
            <Avatar
              variant="surface"
              className={classes.avatar}
              aria-hidden="true"
            >
              <IconUser size={18} aria-hidden="true" />
            </Avatar>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <div className={classes.identity}>
            {name && (
              <Text fw={500} truncate title={name}>
                {name}
              </Text>
            )}
            <Text c="dimmed" fz="sm" truncate title={email}>
              {email}
            </Text>
          </div>
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconSettings size={18} aria-hidden="true" />}
            onClick={settingsHandlers.open}
          >
            Configurações
          </Menu.Item>
          <Menu.Item
            leftSection={<IconUserEdit size={18} aria-hidden="true" />}
            onClick={renameHandlers.open}
          >
            Alterar nome
          </Menu.Item>
          <Menu.Item
            leftSection={<IconLock size={18} aria-hidden="true" />}
            onClick={passwordHandlers.open}
          >
            Alterar senha
          </Menu.Item>
          <Menu.Item
            leftSection={<IconKey size={18} aria-hidden="true" />}
            onClick={tokensHandlers.open}
          >
            Tokens de acesso
          </Menu.Item>
          <Menu.Item
            leftSection={
              download.building ? (
                <Loader size={18} aria-hidden="true" />
              ) : (
                <IconDownload size={18} aria-hidden="true" />
              )
            }
            closeMenuOnClick={false}
            disabled={download.building}
            aria-busy={download.building}
            onClick={() => download.start(menuHandlers.close)}
          >
            Baixar meus dados
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconLogout size={18} aria-hidden="true" />}
            onClick={signOutHandlers.open}
          >
            Sair
          </Menu.Item>
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={18} aria-hidden="true" />}
            onClick={deleteHandlers.open}
          >
            Excluir conta
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <SettingsModal opened={settings} onClose={settingsHandlers.close} />
      <ChangeNameModal opened={rename} onClose={renameHandlers.close} />
      <ChangePasswordModal opened={password} onClose={passwordHandlers.close} />
      <AccessTokensModal opened={tokens} onClose={tokensHandlers.close} />
      <SignOutModal opened={signOut} onClose={signOutHandlers.close} />
      <DeleteAccountModal opened={remove} onClose={deleteHandlers.close} />
      <DataDownloadFailure download={download} />
    </>
  );
}
