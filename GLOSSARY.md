# Mensal

Forecasting and settling a person's monthly cash flow: what comes in and goes out each month, and what has already been paid or received.

## Users

**Approval**:
The manual release an administrator grants a newly signed-up user; without it the user cannot use the product.
_UI (pt-BR)_: Aprovação
_Avoid_: activation, verification, confirmation

**Change password**:
To replace one's password while signed in, proving it with the current one.
_UI (pt-BR)_: Alterar senha
_Avoid_: update password, edit password

**Change name**:
To replace the name a user is addressed by; it never affects how they sign in.
_UI (pt-BR)_: Alterar nome
_Avoid_: edit profile, rename, update name, display name

**Reset password**:
To replace a forgotten password through a link sent to the user's email, without signing in.
_UI (pt-BR)_: Redefinir senha (requested from "Esqueci a senha")
_Avoid_: recover password, change password

**Access token**:
A secret a user creates to let an agent of their own act on their data on their behalf; it can be revoked at any time.
_UI (pt-BR)_: Token de acesso
_Avoid_: API key, secret, password, credential

**Preference**:
A choice a user makes about how the product behaves for them, shared by every device they sign in on; it never changes their data.
_UI (pt-BR)_: Configurações
_Avoid_: setting, config, option

**Theme**:
The preference that sets the product's colours: dark (the default), light, or automatic, which follows the device's own setting. In code, `colorScheme`: `dark`, `light` or `auto`.
_UI (pt-BR)_: Tema (Escuro, Claro, Automático)
_Avoid_: appearance, mode, skin

**View**:
The preference that sets how the monthly screen shows its occurrences: as a grouped list (the default) or as a table. In code, `occurrenceView`: `list` or `table`.
_UI (pt-BR)_: Visualização (Lista, Tabela)
_Avoid_: layout, mode, display

## Time

**Period**:
The calendar month in which an occurrence is expected to be settled; its due date, when present, always falls within it.
_UI (pt-BR)_: Competência
_Avoid_: competence, reference month, accrual month

**Current period**:
The period containing today.
_UI (pt-BR)_: Mês atual
_Avoid_: this month, present month

**Due date**:
The date by which an occurrence should be settled. It may be absent.
_UI (pt-BR)_: Vencimento
_Avoid_: payment date

## Recurrences

**Recurrence**:
A monthly commitment that gives rise to one occurrence in each period, from its start until it is ended.
_UI (pt-BR)_: Recorrência
_Avoid_: subscription, recurring bill, contract

**End**:
To set the last period of a recurrence; nothing that already exists is deleted.
_UI (pt-BR)_: Encerrar
_Avoid_: cancel, deactivate, close

## Occurrences

**Occurrence**:
An inflow or outflow of money in a specific period.
_UI (pt-BR)_: Ocorrência (on screen, usually "conta")
_Avoid_: bill, entry, transaction

**Inflow**:
An occurrence in which money reaches the user.
_UI (pt-BR)_: Entrada
_Avoid_: credit, income, revenue

**Outflow**:
An occurrence in which money leaves the user.
_UI (pt-BR)_: Saída
_Avoid_: debit, expense

**Virtual occurrence**:
An occurrence projected from a recurrence that does not yet exist on its own.
_UI (pt-BR)_: not shown as a distinct concept
_Avoid_: ghost, phantom, projected occurrence

**One-off occurrence**:
An occurrence that does not come from any recurrence.
_UI (pt-BR)_: Avulsa
_Avoid_: standalone, ad-hoc, single expense

**Materialization**:
The moment a virtual occurrence starts to exist on its own, freezing the data it inherited from its recurrence.
_Avoid_: persist, convert

**Settle**:
To record that an occurrence was actually paid or received.
_UI (pt-BR)_: Liquidar
_Avoid_: pay, receive, clear

**Skip**:
To waive a recurrence's occurrence in a single period, without affecting the others.
_UI (pt-BR)_: Pular
_Avoid_: ignore, cancel

**Overdue**:
A pending occurrence whose due date has already passed.
_UI (pt-BR)_: Atrasada
_Avoid_: late, past due

## Summary

**Expected**:
The total of a period's pending and settled occurrences.
_UI (pt-BR)_: Previsto
_Avoid_: planned, forecast

**Settled** (total):
The total of a period's settled occurrences only.
_UI (pt-BR)_: Realizado
_Avoid_: actual, realized

**Left over** (total):
A period's expected inflows minus its expected outflows; negative when the period is short. Computed by the client, never stored.
_UI (pt-BR)_: Sobra prevista
_Avoid_: balance, net, profit

**Trend**:
The expected and settled totals and the left over of a run of consecutive periods ending at the period on screen, laid side by side to show how they change from month to month. The run may reach into future periods.
_UI (pt-BR)_: Evolução
_Avoid_: history, report, dashboard

**Accumulated left over**:
The running sum of each period's left over across a trend, starting from zero at its first period; it changes when the trend covers a different run of periods. Computed by the client, never stored.
_UI (pt-BR)_: Sobra acumulada
_Avoid_: balance, running balance, savings
