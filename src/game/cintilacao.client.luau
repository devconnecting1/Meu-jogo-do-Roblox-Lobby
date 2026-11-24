--!strict
-- Cintilação suave das lâmpadas velhas da prisão abandonada (efeito visual, sem gameplay).
-- Roda só no cliente (StarterPlayerScripts): cada jogador vê o próprio piscar, sem tráfego de rede.
-- As lâmpadas que piscam são as luzes chamadas "Luz Piscando" (geradas em src/prison.js com flicker: true).
-- Regra do projeto (AGENTS.md, regra 3): este é o ÚNICO script permitido; não cria nem apaga instâncias.

local RunService = game:GetService("RunService")
local prisao = workspace:WaitForChild("Prisão")

type Lamp = { light: Light, part: BasePart, base: number, color: Color3, seed: number }
local lamps: { Lamp } = {}

local function add(light: Instance)
	if light:IsA("Light") and light.Name == "Luz Piscando" and light.Parent and light.Parent:IsA("BasePart") then
		local l = light :: Light
		local part = l.Parent :: BasePart
		table.insert(lamps, { light = l, part = part, base = l.Brightness, color = part.Color, seed = #lamps * 7.31 + 1 })
	end
end

for _, d in prisao:GetDescendants() do
	add(d)
end
prisao.DescendantAdded:Connect(add)

local APAGADA = Color3.fromRGB(70, 72, 74)
local t = 0
RunService.RenderStepped:Connect(function(dt: number)
	t += dt
	for _, l in lamps do
		-- oscilação lenta (ruído suave) + quedas rápidas e raras, como reator velho
		local slow = math.noise(t * 0.9, l.seed) -- -1..1
		local fast = math.noise(t * 7, l.seed + 40)
		local k = math.clamp(0.72 + 0.28 * slow, 0.4, 1)
		if fast > 0.42 then
			k *= 0.25
		end
		l.light.Brightness = l.base * k
		l.part.Color = APAGADA:Lerp(l.color, k)
	end
end)
