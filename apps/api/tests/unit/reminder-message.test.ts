import { describe, expect, it } from "vitest";
import { reminderMessage } from "../../src/reminder-message.ts";

const outflow = (description: string) =>
  ({ direction: "OUTFLOW", description }) as const;
const inflow = (description: string) =>
  ({ direction: "INFLOW", description }) as const;

describe("the reminder's wording (PRD §6.8)", () => {
  it("names the one occurrence due today", () => {
    expect(reminderMessage([outflow("Aluguel")], [])).toEqual({
      title: "Vence hoje: Aluguel",
      body: "Aluguel",
    });
  });

  it("counts several due today and lists them", () => {
    expect(reminderMessage([outflow("Aluguel"), outflow("Luz")], [])).toEqual({
      title: "2 contas vencem hoje",
      body: "Aluguel e Luz",
    });
    expect(
      reminderMessage([outflow("Aluguel"), outflow("Luz"), outflow("Gás")], [])
    ).toEqual({
      title: "3 contas vencem hoje",
      body: "Aluguel, Luz e Gás",
    });
  });

  it("lists at most 3 descriptions and counts the rest", () => {
    expect(
      reminderMessage(
        ["Aluguel", "Luz", "Internet", "Gás", "Água"].map(outflow),
        []
      )
    ).toEqual({
      title: "5 contas vencem hoje",
      body: "Aluguel, Luz, Internet e mais 2",
    });
  });

  it("counts the overdue ones when nothing is due today", () => {
    expect(reminderMessage([], [outflow("Luz")])).toEqual({
      title: "1 conta atrasada",
      body: "Luz",
    });
    expect(
      reminderMessage([], ["Luz", "Gás", "Água", "Internet"].map(outflow))
    ).toEqual({
      title: "4 contas atrasadas",
      body: "Luz, Gás, Água e mais 1",
    });
  });

  it("lists the ones due today first and adds a line for the overdue", () => {
    expect(reminderMessage([outflow("Aluguel")], [outflow("Luz")])).toEqual({
      title: "Vence hoje: Aluguel",
      body: "Aluguel e Luz\n+ 1 atrasada",
    });
    expect(
      reminderMessage(
        [outflow("Aluguel"), outflow("Internet")],
        ["Luz", "Gás", "Água"].map(outflow)
      )
    ).toEqual({
      title: "2 contas vencem hoje",
      body: "Aluguel, Internet, Luz e mais 2\n+ 3 atrasadas",
    });
  });

  it("prefixes an inflow's description", () => {
    expect(reminderMessage([inflow("Salário")], [outflow("Luz")])).toEqual({
      title: "Vence hoje: Entrada: Salário",
      body: "Entrada: Salário e Luz\n+ 1 atrasada",
    });
    expect(reminderMessage([], [inflow("Reembolso")])).toEqual({
      title: "1 conta atrasada",
      body: "Entrada: Reembolso",
    });
  });

  it("has nothing to say when nothing is due or overdue", () => {
    expect(reminderMessage([], [])).toBeNull();
  });
});
