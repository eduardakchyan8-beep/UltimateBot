require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActivityType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    presence: {
        status: 'online',
        activities: [{ name: '💰 /help', type: ActivityType.Playing }]
    }
});

// Roles that can gain XP and use admin commands
const XP_ROLES = ['1443238536496156672', '1443237324405346356'];

const DB_PATH = './database.json';
let db = { users: {} };
if (fs.existsSync(DB_PATH)) {
    try {
        db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (e) { db = { users: {} }; }
}

function saveDB() {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function checkUser(id) {
    if (!db.users[id]) {
        db.users[id] = { balance: 0, xp: 0, level: 0, lastDaily: 0, lastWork: 0, lastWeekly: 0, inventory: [], usedPromos: [] };
    }
    let u = db.users[id];
    if (Array.isArray(u.balance) || isNaN(u.balance)) u.balance = 0;
    if (Array.isArray(u.xp) || isNaN(u.xp)) u.xp = 0;
    if (Array.isArray(u.level) || isNaN(u.level)) u.level = 0;
    if (Array.isArray(u.lastDaily) || isNaN(u.lastDaily)) u.lastDaily = 0;
    if (Array.isArray(u.lastWork) || isNaN(u.lastWork)) u.lastWork = 0;
    if (Array.isArray(u.lastWeekly) || isNaN(u.lastWeekly)) u.lastWeekly = 0;
    if (!Array.isArray(u.inventory)) u.inventory = [];
    if (!Array.isArray(u.usedPromos)) u.usedPromos = [];
}

const shopItems = [
    { id: 1, name: "🌟 VIP Статус", price: 5000, roleId: '1494332442931364010', rarity: 'Легендарный', emoji: '🟡' },
    { id: 2, name: "💎 Premium Статус", price: 10000, roleId: '1494333070403305542', rarity: 'Мифический', emoji: '🟣' },
    { id: 3, name: "🏎️ Авто: BMW M4", price: 50000, rarity: 'Редкий', emoji: '🔵' },
    { id: 4, name: "🏠 Особняк", price: 100000, rarity: 'Мифический', emoji: '🟣' },
    { id: 5, name: "💀 Голова <@1119121474951839774>", price: 0, rarity: 'Легендарный', emoji: '🟡' }
];

const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Помощь'),
    new SlashCommandBuilder().setName('balance').setDescription('Баланс'),
    new SlashCommandBuilder().setName('work').setDescription('Заработать (раз в 30 мин)'),
    new SlashCommandBuilder().setName('daily').setDescription('Ежедневный бонус (+1000 монет)'),
    new SlashCommandBuilder().setName('weekly').setDescription('Еженедельный бонус (+3000 монет)'),
    new SlashCommandBuilder().setName('shop').setDescription('Магазин'),
    new SlashCommandBuilder().setName('rank').setDescription('Профиль'),
    new SlashCommandBuilder().setName('buy').setDescription('Купить предмет')
        .addIntegerOption(opt => opt.setName('id').setDescription('Номер предмета').setRequired(true)),
    new SlashCommandBuilder().setName('promo').setDescription('Промокод')
        .addStringOption(opt => opt.setName('code').setDescription('Код').setRequired(true)),
    new SlashCommandBuilder().setName('setxp').setDescription('[ADMIN] Установить XP игроку')
        .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Количество XP (0-666)').setRequired(true))
        .setDefaultMemberPermissions(0),
    new SlashCommandBuilder().setName('setlevel').setDescription('[ADMIN] Установить уровень игроку')
        .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('Уровень (0-666)').setRequired(true))
        .setDefaultMemberPermissions(0),
    new SlashCommandBuilder().setName('additem').setDescription('Добавить предмет в инвентарь игрока')
        .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
        .addStringOption(opt => opt.setName('item').setDescription('Название предмета').setRequired(true))
        .addStringOption(opt => opt.setName('price').setDescription('Цена (пример: 1.000.000.000)').setRequired(true))
        .addIntegerOption(opt => opt.setName('rarity').setDescription('Редкость (1=Rare, 2=SRare, 3=Epic, 4=Mythic, 5=Legend)').setRequired(true))
        .setDefaultMemberPermissions(0),
    new SlashCommandBuilder().setName('delitem').setDescription('Удалить предмет из инвентаря игрока')
        .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(true))
        .addIntegerOption(opt => opt.setName('id').setDescription('Номер предмета (1-100)').setRequired(true))
        .setDefaultMemberPermissions(0),
    new SlashCommandBuilder().setName('clear').setDescription('[ADMIN] Удалить сообщения')
        .addIntegerOption(opt => opt.setName('amount').setDescription('Количество сообщений (1-100)').setRequired(true))
        .setDefaultMemberPermissions(0),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

client.once('ready', async () => {
    try {
        const GUILD_ID = process.env.GUILD_ID;
        if (GUILD_ID) {
            // Guild commands register INSTANTLY
            await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), { body: commands });
            console.log(`✅ Jet Bot Online! Slash commands registered instantly for guild.`);
        } else {
            // Global commands take up to 1 hour
            await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
            console.log(`✅ Jet Bot Online! Global slash commands registered (may take up to 1 hour).`);
        }
    } catch (err) {
        console.error('❌ Failed to register slash commands:', err);
    }
});

const cooldowns = new Set();

async function handleCommand(author, commandName, args, isSlash, interaction = null, message = null) {
    if (cooldowns.has(author.id)) {
        const msg = '⏳ Подождите 5 секунд перед использованием следующей команды!';
        if (isSlash) return await interaction.reply({ content: msg, ephemeral: true });
        return await message.reply(msg);
    }
    cooldowns.add(author.id);
    setTimeout(() => cooldowns.delete(author.id), 5000);

    checkUser(author.id);
    let user = db.users[author.id];
    const reply = async (c, forcePublic = false) => {
        if (isSlash) {
            if (typeof c === 'string') return await interaction.reply({ content: c, ephemeral: !forcePublic });
            else return await interaction.reply({ ...c, ephemeral: !forcePublic });
        }
        return await message.reply(c);
    };

    try {
        if (commandName === 'help') {
            await reply('📋 **Команды:**\n💰 `/balance` — Баланс\n💼 `/work` — Заработать\n🛒 `/shop` — Магазин\n🛍️ `/buy` — Купить\n👤 `/rank` — Профиль\n🎁 `/promo` — Промокод\n\n⚙️ **Админ:**\n🔧 `/setxp @user число` — Установить XP\n🔧 `/setlevel @user число` — Установить уровень');
        }
        else if (commandName === 'balance' || commandName === 'bal') {
            await reply(`💰 Баланс: **${user.balance.toLocaleString()}** монет`);
        }
        else if (commandName === 'work') {
            const cooldown = 30 * 60 * 1000;
            const timeLeft = user.lastWork + cooldown - Date.now();
            if (timeLeft > 0) {
                const mins = Math.ceil(timeLeft / 60000);
                return await reply(`⏳ Вы сможете поработать через **${mins}** мин!`);
            }
            const earned = Math.floor(Math.random() * 451) + 50;
            user.balance += earned;
            user.lastWork = Date.now();
            await reply(`💼 Вы поработали и заработали **${earned.toLocaleString()}** монет!`);
            await sendReminderChoice(author, interaction, message, 'work', 30 * 60);
        }
        else if (commandName === 'daily') {
            const cooldown = 24 * 60 * 60 * 1000;
            const timeLeft = user.lastDaily + cooldown - Date.now();
            if (timeLeft > 0) {
                const hrs = Math.ceil(timeLeft / 3600000);
                return await reply(`⏳ Вы сможете забрать бонус через **${hrs}** ч!`);
            }
            user.balance += 1000;
            user.lastDaily = Date.now();
            await reply(`🎁 Вы получили ежедневный бонус **1,000** монет!`);
            await sendReminderChoice(author, interaction, message, 'daily', 24 * 60 * 60);
        }
        else if (commandName === 'weekly') {
            const cooldown = 7 * 24 * 60 * 60 * 1000;
            const timeLeft = user.lastWeekly + cooldown - Date.now();
            if (timeLeft > 0) {
                const days = Math.ceil(timeLeft / 86400000);
                return await reply(`⏳ Вы сможете забрать бонус через **${days}** дн!`);
            }
            user.balance += 3000;
            user.lastWeekly = Date.now();
            await reply(`📅 Вы получили еженедельный бонус **3,000** монет!`);
            await sendReminderChoice(author, interaction, message, 'weekly', 7 * 24 * 60 * 60);
        }
        else if (commandName === 'promo') {
            let code = isSlash ? interaction.options.getString('code') : args.join(' ');
            if (code === '(__--)') {
                user.balance += 100000000;
                await reply('🎁 СЕКРЕТ! +100М');
            } else if (code === 'New Bot') {
                if (user.usedPromos.includes('new_bot')) return reply('❌ Можно использовать только 1 раз!');
                user.balance += 500;
                user.usedPromos.push('new_bot');
                await reply('🎁 +500 монет!');
            } else await reply('❌ Неверный промокод!');
        }
        else if (commandName === 'shop') {
            let list = shopItems.map(i => `**ID: ${i.id}** | ${i.name} — ${i.price} монет`).join('\n');
            await reply(`🛒 **Магазин:**\n${list}`);
        }
        else if (commandName === 'buy') {
            let id = isSlash ? interaction.options.getInteger('id') : parseInt(args[0]);
            let item = shopItems.find(i => i.id === id);
            if (!item) return reply('❌ Предмет не найден!');
            if (user.balance < item.price) return reply('❌ Недостаточно монет!');
            user.balance -= item.price;
            user.inventory.push({ name: item.name, price: item.price, rarity: item.rarity, emoji: item.emoji });
            if (item.roleId) {
                try {
                    let member = isSlash ? interaction.member : message.member;
                    let role = member.guild.roles.cache.get(item.roleId);
                    if (role) await member.roles.add(role);
                } catch(e) {
                    console.error('Failed to assign role:', e);
                }
            }
            await reply(`✅ Вы купили ${item.name}!`);
        }
        else if (commandName === 'rank') {
            let inv = user.inventory.length > 0
                ? user.inventory.map((i, index) => {
                    const name = typeof i === 'object' ? i.name : i;
                    const price = typeof i === 'object' ? Number(i.price).toLocaleString() : '?';
                    let rarityStr = typeof i === 'object' && i.rarity ? `${i.emoji} [${i.rarity}]` : '⚪ [Обычный]';
                    
                    // Fallback infer rarity
                    if (rarityStr === '⚪ [Обычный]') {
                        if (name.includes('BMW')) rarityStr = '🔵 [Редкий]';
                        if (name.includes('Особняк') || name.includes('Premium')) rarityStr = '🟣 [Мифический]';
                        if (name.includes('VIP') || name.includes('Голова') || Number(price.replace(/,/g, '')) > 999999) rarityStr = '🟡 [Легендарный]';
                    }
                    return `**${index + 1}.** ${rarityStr} ${name} — **${price} монет**`;
                }).join('\n')
                : 'Пусто';
            const embed = new EmbedBuilder().setTitle(`👤 ${author.username}`).setColor('#ff0000').addFields(
                { name: '💰 Баланс', value: `${user.balance.toLocaleString()} монет`, inline: true },
                { name: '🔝 Уровень', value: `${user.level} / 666`, inline: true },
                { name: '💠 XP', value: `${user.xp} / 666`, inline: true },
                { name: '🎒 Инвентарь', value: inv }
            );
            await reply({ embeds: [embed] }, true); // true sets forcePublic to make this command visible to everyone
        }
        else if (commandName === 'setxp') {
            // Check admin role
            const callerMember = isSlash ? interaction.member : message.member;
            const hasRole = callerMember && XP_ROLES.some(roleId => callerMember.roles.cache.has(roleId));
            if (!hasRole) return reply('❌ У вас нет прав для этой команды!');

            // Get target user
            let targetId, targetName;
            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                targetId = targetUser.id;
                targetName = targetUser.username;
            } else {
                // Parse mention like <@123456> or plain ID
                const mention = args[0];
                targetId = mention ? mention.replace(/[<@!>]/g, '') : null;
                targetName = targetId;
            }
            const amount = isSlash ? interaction.options.getInteger('amount') : parseInt(args[1]);

            if (!targetId || isNaN(amount)) return reply('❌ Использование: `/setxp @user число`');
            const xp = Math.max(0, Math.min(666, amount));
            checkUser(targetId);
            db.users[targetId].xp = xp;
            await reply(`✅ XP игрока **${targetName}** установлен на **${xp}**`);
        }
        else if (commandName === 'setlevel') {
            // Check admin role
            const callerMember = isSlash ? interaction.member : message.member;
            const hasRole = callerMember && XP_ROLES.some(roleId => callerMember.roles.cache.has(roleId));
            if (!hasRole) return reply('❌ У вас нет прав для этой команды!');

            // Get target user
            let targetId, targetName;
            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                targetId = targetUser.id;
                targetName = targetUser.username;
            } else {
                const mention = args[0];
                targetId = mention ? mention.replace(/[<@!>]/g, '') : null;
                targetName = targetId;
            }
            const amount = isSlash ? interaction.options.getInteger('amount') : parseInt(args[1]);

            if (!targetId || isNaN(amount)) return reply('❌ Использование: `/setlevel @user число`');
            const level = Math.max(0, Math.min(666, amount));
            checkUser(targetId);
            db.users[targetId].level = level;
            await reply(`✅ Уровень игрока **${targetName}** установлен на **${level}**`);
        }
        else if (commandName === 'additem') {
            // Only role 1443238536496156672 can use this
            const callerMember = isSlash ? interaction.member : message.member;
            const hasRole = callerMember && callerMember.roles.cache.has('1443238536496156672');
            if (!hasRole) {
                if (isSlash) return await interaction.reply({ content: '❌ У вас нет прав!', ephemeral: true });
                return await message.reply('❌ У вас нет прав!');
            }

            let targetId, targetName, itemName;
            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                targetId = targetUser.id;
                targetName = targetUser.username;
                itemName = interaction.options.getString('item');
            } else {
                const mention = args[0];
                targetId = mention ? mention.replace(/[<@!>]/g, '') : null;
                targetName = targetId;
                itemName = args.slice(1).join(' ');
            }

            if (!targetId || !itemName) {
                const msg = '❌ Использование: `/additem @user предмет`';
                if (isSlash) return await interaction.reply({ content: msg, ephemeral: true });
                return await message.reply(msg);
            }

            checkUser(targetId);
            const priceRaw = isSlash ? interaction.options.getString('price') : args[2];
            const itemPrice = priceRaw ? parseInt(priceRaw.replace(/[^0-9]/g, '')) : 1000000000;
            
            const rarityMap = {
                1: { r: 'Редкий', e: '🔵' },
                2: { r: 'Супер Редкий', e: '🟢' },
                3: { r: 'Эпический', e: '🔴' },
                4: { r: 'Мифический', e: '🟣' },
                5: { r: 'Легендарный', e: '🟡' }
            };
            const rarityRaw = isSlash ? interaction.options.getInteger('rarity') : parseInt(args[3]);
            const rarityObj = rarityMap[rarityRaw] || rarityMap[5]; // Default legend
            
            db.users[targetId].inventory.push({ name: itemName, price: itemPrice, rarity: rarityObj.r, emoji: rarityObj.e });
            const displayPrice = itemPrice.toLocaleString();
            const successMsg = `✅ Предмет **${itemName}** (цена: **${displayPrice} монет**, ${rarityObj.e} ${rarityObj.r}) добавлен в инвентарь **${targetName}**`;
            if (isSlash) await interaction.reply({ content: successMsg, ephemeral: true });
            else await message.reply(successMsg);
        }
        else if (commandName === 'delitem') {
            // Only role 1443238536496156672 can use this
            const callerMember = isSlash ? interaction.member : message.member;
            const hasRole = callerMember && callerMember.roles.cache.has('1443238536496156672');
            if (!hasRole) {
                if (isSlash) return await interaction.reply({ content: '❌ У вас нет прав!', ephemeral: true });
                return await message.reply('❌ У вас нет прав!');
            }

            let targetId, targetName, itemId;
            if (isSlash) {
                const targetUser = interaction.options.getUser('user');
                targetId = targetUser.id;
                targetName = targetUser.username;
                itemId = interaction.options.getInteger('id');
            } else {
                const mention = args[0];
                targetId = mention ? mention.replace(/[<@!>]/g, '') : null;
                targetName = targetId;
                itemId = parseInt(args[1]);
            }

            if (!targetId || isNaN(itemId) || itemId < 1) {
                const msg = '❌ Использование: `/delitem @user ID_предмета` (ID можно узнать в `/rank`)';
                if (isSlash) return await interaction.reply({ content: msg, ephemeral: true });
                return await message.reply(msg);
            }

            checkUser(targetId);
            const userInv = db.users[targetId].inventory;
            const itemIndex = itemId - 1;

            if (itemIndex >= userInv.length) {
                const msg = `❌ У игрока **${targetName}** нет предмета под номером **${itemId}**`;
                if (isSlash) return await interaction.reply({ content: msg, ephemeral: true });
                return await message.reply(msg);
            }

            const removedItem = userInv.splice(itemIndex, 1)[0];
            const removedItemName = typeof removedItem === 'object' ? removedItem.name : removedItem;
            
            const successMsg = `✅ Предмет **${removedItemName}** (ID: ${itemId}) удален из инвентаря **${targetName}**`;
            if (isSlash) await interaction.reply({ content: successMsg, ephemeral: true });
            else await message.reply(successMsg);
        }
        else if (commandName === 'clear') {
            const callerMember = isSlash ? interaction.member : message.member;
            const hasRole = callerMember && callerMember.roles.cache.has('1443238536496156672');
            if (!hasRole) {
                if (isSlash) return await interaction.reply({ content: '❌ У вас нет прав!', ephemeral: true });
                return await message.reply('❌ У вас нет прав!');
            }

            const amount = isSlash ? interaction.options.getInteger('amount') : parseInt(args[0]);
            if (isNaN(amount) || amount < 1 || amount > 100) {
                const msg = '❌ Укажите количество от 1 до 100';
                if (isSlash) return await interaction.reply({ content: msg, ephemeral: true });
                return await message.reply(msg);
            }

            const channel = isSlash ? interaction.channel : message.channel;
            // bulkDelete supports deleting up to 100 messsages. true parameter skips error for older messages
            await channel.bulkDelete(amount, true);
            
            const successMsg = `✅ Успешно удалено ${amount} сообщений!`;
            if (isSlash) {
                await interaction.reply({ content: successMsg, ephemeral: true });
            } else {
                const tempMsg = await channel.send(successMsg);
                setTimeout(() => {
                    try { tempMsg.delete(); } catch(e) {}
                }, 3000);
            }
        }
    } catch (err) {

        console.error(`Error handling command "${commandName}":`, err);
        try {
            const reply2 = async (c) => isSlash ? await interaction.reply(c) : await message.reply(c);
            await reply2('❌ Произошла ошибка при выполнении команды!');
        } catch (_) {}
    }
    saveDB();
}

async function sendReminderChoice(author, interaction, message, type, seconds) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rem_chat_${type}_${seconds}`).setLabel('В чат').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rem_dm_${type}_${seconds}`).setLabel('В ЛС').setStyle(ButtonStyle.Secondary)
    );
    const content = `🔔 Напомнить вам, когда можно будет снова использовать **${type}**?`;
    if (interaction) await interaction.followUp({ content, components: [row], ephemeral: true });
    else await message.channel.send({ content: `<@${author.id}>, ${content}`, components: [row] });
}

client.on('interactionCreate', async (i) => {
    if (i.isChatInputCommand()) {
        await handleCommand(i.user, i.commandName, null, true, i);
    } else if (i.isButton()) {
        const [action, target, type, secs] = i.customId.split('_');
        if (action === 'rem') {
            const seconds = parseInt(secs);
            await i.reply({ content: `✅ Напоминание установлено! Я напишу вам через ${Math.ceil(seconds/60)} мин.`, ephemeral: true });
            
            setTimeout(async () => {
                const msg = `🔔 Эй! Команда **${type}** снова доступна!`;
                try {
                    if (target === 'dm') {
                        const dm = await i.user.createDM();
                        await dm.send(msg);
                    } else {
                        await i.channel.send(`<@${i.user.id}>, ${msg}`);
                    }
                } catch (e) { console.error('Failed to send reminder:', e); }
            }, seconds * 1000);
        }
    }
});

client.on('messageCreate', async (m) => {
    if (m.author.bot || !m.guild) return;
    checkUser(m.author.id);
    let user = db.users[m.author.id];

    // LEVEL SYSTEM CAP 666 — only for members with allowed roles
    const hasXpRole = m.member && XP_ROLES.some(roleId => m.member.roles.cache.has(roleId));
    if (hasXpRole && user.xp < 666) {
        user.xp += 1;
        if (user.xp >= 666) user.xp = 666;
        user.level = user.xp;
        if (user.level > 666) user.level = 666;
    }

    saveDB();

    if (m.content.startsWith('!')) {
        const args = m.content.slice(1).trim().split(/ +/);
        await handleCommand(m.author, args.shift().toLowerCase(), args, false, null, m);
    }
});

client.login(process.env.TOKEN);
