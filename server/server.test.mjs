import { test } from "node:test";
import assert from "node:assert";
import WebSocket from "ws";
import { createServer, validState } from "./server.mjs";

const state = (n, x) => ({ v: 1, n, h: "ninja", g: "#05d9e8", l: "city", p: [x, 1, 2], r: 0, a: 1, m: "foot" });

test("validState rejects junk", () => {
  assert.equal(validState(state("Ann", 1)), true);
  assert.equal(validState({ v: 1, p: [1, 2] }), false);
  assert.equal(validState({ ...state("x".repeat(40), 1) }), false);
});

test("two players see each other", async () => {
  const wss = createServer(18787);
  const open = (name, x) =>
    new Promise((res) => {
      const ws = new WebSocket("ws://127.0.0.1:18787");
      ws.on("open", () => {
        ws.send(JSON.stringify({ t: "hello", room: "hub" }));
        ws.send(JSON.stringify({ t: "state", s: state(name, x) }));
        res(ws);
      });
    });
  const a = await open("Ann", 1);
  const b = await open("Bob", 2);
  const seen = await new Promise((res) => {
    a.on("message", (d) => {
      const m = JSON.parse(d.toString());
      if (m.t === "peers" && m.peers.length) res(m.peers);
    });
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].s.n, "Bob");
  a.close();
  b.close();
  wss.close();
});
