--!strict
-- Escolhe o reino deste servidor. Único script do lugar: não cria peças nem tem gameplay,
-- só sorteia uma das variantes geradas em src/map.js (createWorld(semente)).
-- O mapa principal já está no Workspace ("Reino"); as outras variantes ficam em ServerStorage/Mapas.
local ServerStorage = game:GetService("ServerStorage")

local pasta = ServerStorage:FindFirstChild("Mapas")
local variantes = if pasta then pasta:GetChildren() else {}
table.sort(variantes, function(a, b)
	return a.Name < b.Name
end)

local atual = workspace:FindFirstChild("Reino")
local sorteio = Random.new():NextInteger(0, #variantes)

if sorteio > 0 and atual then
	local escolhida = variantes[sorteio]
	local nome = escolhida.Name
	atual:Destroy()
	escolhida.Name = "Reino"
	escolhida.Parent = workspace
	workspace:SetAttribute("Variante", nome)
else
	workspace:SetAttribute("Variante", "Principal")
end
