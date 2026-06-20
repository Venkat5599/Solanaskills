# Deploy the live demo on a VPS

The demo agent talks to the AICredits gateway (`api.aicredits.in`). Run it on the
VPS — from there the gateway is reachable.

## One command

SSH into the VPS, clone the repo, run setup with your key:

```bash
git clone https://github.com/Venkat5599/Solanaskills
cd Solanaskills/demo-app
AICREDITS_API_KEY=sk-live-... bash deploy/setup.sh
```

That script (idempotent — re-run after any `git pull`):
1. installs **Bun** if missing,
2. `bun install`,
3. writes `.env` (chmod 600; key + model),
4. registers a **systemd** service (`solana-confidential-demo`) that auto-restarts and survives reboot,
5. starts it and prints `/api/health`.

Override defaults with env vars: `PORT`, `MODEL`, `MODEL_FALLBACK`, `AICREDITS_BASE_URL`, `SERVICE`.

## Expose it

- **Quick:** open the port in the firewall — `sudo ufw allow 8787` — then visit `http://<vps-ip>:8787`.
- **Proper:** front it with nginx (port 80/443) — see `nginx.conf.example`; add TLS with
  `sudo certbot --nginx -d your-domain`.

## Operate

```bash
systemctl status solana-confidential-demo      # state
journalctl -u solana-confidential-demo -f      # live logs
sudo systemctl restart solana-confidential-demo
curl -s http://127.0.0.1:8787/api/health       # { model, provider, keySet }
```

Update after a push:
```bash
cd Solanaskills && git pull && cd demo-app && bash deploy/setup.sh   # key already in .env; no need to re-pass
```

## Verify the chat works (the hop my machine couldn't reach)

```bash
curl -s -X POST http://127.0.0.1:8787/api/chat \
  -H 'content-type: application/json' \
  -d '{"history":[{"role":"user","content":"Run the compliance demo on the structuring scenario"}]}'
```

You should get a reply that ran `run_compliance_demo` (a `trace` array with the tool call) and the
real flags + report hash. If the model id is rejected, the server auto-retries `deepseek/deepseek-chat`
(or set `MODEL=deepseek/deepseek-chat` in `.env`).

## Security

- `.env` is `chmod 600` and gitignored — the key never enters the repo.
- The chat spends your gateway credits; **rate-limit or put it behind a password** before sharing a
  public URL (nginx `auth_basic`, or a Cloudflare Access policy).
- Rotate the key after the event.
