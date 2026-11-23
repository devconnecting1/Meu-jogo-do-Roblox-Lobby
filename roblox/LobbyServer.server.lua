--!strict
-- LobbyServer: plataformas "Fila 1/2/3" da Zona Jogar.
-- Montado no lugar pelo Rojo (default.project.json). Não edite no Studio:
-- a próxima sincronização sobrescreve o lugar inteiro).
--
-- Para teletransportar para o jogo principal, coloque o ID do lugar de
-- destino em TARGET_PLACE_ID. Com 0, a plataforma só avisa o jogador.

local Players = game:GetService("Players")
local TeleportService = game:GetService("TeleportService")

local TARGET_PLACE_ID = 0
local COOLDOWN = 3

local lobby = workspace:WaitForChild("Lobby Prisão")
local zona = lobby:WaitForChild("Átrio"):WaitForChild("Zona Jogar")

local lastTouch: { [Player]: number } = {}

local function onPadTouched(padName: string, hit: BasePart)
	local character = hit.Parent
	if not character then
		return
	end
	local player = Players:GetPlayerFromCharacter(character)
	if not player then
		return
	end
	local now = os.clock()
	if lastTouch[player] and now - lastTouch[player] < COOLDOWN then
		return
	end
	lastTouch[player] = now

	if TARGET_PLACE_ID ~= 0 then
		local ok, err = pcall(function()
			TeleportService:TeleportAsync(TARGET_PLACE_ID, { player })
		end)
		if not ok then
			warn(`[Lobby] Falha ao teleportar {player.Name}: {err}`)
		end
	else
		print(`[Lobby] {player.Name} entrou na {padName} (defina TARGET_PLACE_ID para teleportar)`)
	end
end

for _, name in { "Fila 1", "Fila 2", "Fila 3" } do
	local pad = zona:FindFirstChild(name)
	if pad and pad:IsA("BasePart") then
		pad.Touched:Connect(function(hit)
			onPadTouched(name, hit)
		end)
	end
end

Players.PlayerRemoving:Connect(function(player)
	lastTouch[player] = nil
end)
