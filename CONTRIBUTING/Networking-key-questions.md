Key Questions:
--------------
0. Technology:

    - What technology do you want to use to host multiplayer sessions?
      *As previously discussed, this application cannot rely on a service with subscription or recurring fees. As such, this should operate from a simple websocket/socket.io service that can be run locally or hosted on a server.*

1.  Session/Room Structure:

    -   Do you want persistent game sessions that users can join/leave?
        *Yes, persistent sessions.*
    -   Should sessions be created by a DM/GM who invites players?
        *Anyone can start a session since we have role assignment options, however the first person to connect is, by default a DM until they change roles.*
    -   Or more like a shared workspace that anyone can access?
        *Anyone with the link/code can assess it, but we can provide an optional password to "secure" sessions. This does not have to be strong*
2.  What Needs to Sync in Real-Time:

    -   Token positions and states?
        *Yes*
    -   Map changes and fog of war reveals?
        *Each client instance can be responsible for rendering fog of war and map changes, but the data has to be shared to make that possible.*
    -   Initiative tracker updates?
        *Absolutely necessary to share*
    -   Chat/messaging between players?
        *We don't have a chat system that I'm aware of, but when we do, yes, we should share that as well.*
    -   Which cards/panels should be synchronized?
        *Initiative for now. But we could also create a category of card which is synchronized to allow for synced contents later.*
3.  User Roles & Permissions:

    -   I see you have a role system - should this extend to multiplayer (DM vs Player permissions)?
        *Yes, I think we already have this modeled*
    -   What can players do vs what only the DM can do?
        *I think we have this modeled with the current role system. A connected user who is a player and part of a player or custom group would have the permissions provided by that role.*
    -   Should players only see their own tokens or all tokens?
        *Again, we already modeled this in the roles system -- what elements are visible is controled by a users role.*
4.  Data Persistence:

    -   Should game state be saved between sessions?
        *Yes. And it should be exportable to file to allow for a group to save their session and restore it later. Only the a DM role can save a session however. No cheating!*
    -   Do you need game history/replay functionality?
        *Yes, but this can wait until we get to the game/chat log. Honestly we may get some of this when we integrate the engine mechanics which I have in a different project.*
5.  User Management:

    -   Should users create accounts to join sessions?
        *No, no account is necessary. The current "choose a name" mechanic works just fine. We can store the roles by user specified name. If joining a game, unassigned names could be presented as a list to a connecting user or they can choose to enter a name.*
    -   Or allow guest access with session codes?
        *All players connect with session code. the difference between a guest, a player, or a DM is entirely role based.*