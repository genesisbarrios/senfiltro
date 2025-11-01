use anchor_lang::prelude::*;

declare_id!("9TC59EBnNgvCfLzA9U1znL3JnqvAKFHHJtkiUypfn5HP"); // replace with your program id

#[program]
pub mod senfiltro {
    use super::*;

    pub fn initialize_counters(ctx: Context<InitializeCounters>) -> Result<()> {
        let pc = &mut ctx.accounts.post_counter;
        let cc = &mut ctx.accounts.comment_counter;
        pc.count = 0;
        cc.count = 0;
        Ok(())
    }

    pub fn create_post(
        ctx: Context<CreatePost>,
        metadata_cid: String, // ipfs://...
        ai_generated: bool,
    ) -> Result<()> {
        let post = &mut ctx.accounts.post;

        require!(
            metadata_cid.len() <= 200,
            ErrorCode::MetadataCidTooLong
        );

        post.id = ctx.accounts.post_counter.count + 1;
        post.author = *ctx.accounts.author.key;
        post.metadata_cid = metadata_cid;
        post.ai_generated = ai_generated;
        post.likes = 0;
        post.dislikes = 0;
        post.created_at = Clock::get()?.unix_timestamp;
        post.deleted = false;

        ctx.accounts.post_counter.count = post.id;
        Ok(())
    }

    pub fn update_post(
        ctx: Context<UpdatePost>,
        metadata_cid: Option<String>,
        ai_generated: Option<bool>,
    ) -> Result<()> {
        let post = &mut ctx.accounts.post;
        require!(post.author == *ctx.accounts.author.key, ErrorCode::Unauthorized);

        if let Some(cid) = metadata_cid {
            require!(cid.len() <= 200, ErrorCode::MetadataCidTooLong);
            post.metadata_cid = cid;
        }

        if let Some(flag) = ai_generated {
            post.ai_generated = flag;
        }

        Ok(())
    }

    pub fn delete_post(ctx: Context<DeletePost>) -> Result<()> {
        let post = &mut ctx.accounts.post;
        require!(post.author == *ctx.accounts.author.key, ErrorCode::Unauthorized);
        post.deleted = true;

        for comment_info in ctx.remaining_accounts.iter() {
            let mut comment_account: Account<Comment> = Account::try_from(comment_info)?;
            if comment_account.parent_post == Some(post.id) {
                comment_account.parent_post = None;
            }
        }

        Ok(())
    }

    pub fn create_comment(
        ctx: Context<CreateComment>,
        metadata_cid: String,
        parent_post: Option<u64>,
    ) -> Result<()> {
        require!(metadata_cid.len() <= 200, ErrorCode::MetadataCidTooLong);

        let comment = &mut ctx.accounts.comment;
        comment.id = ctx.accounts.comment_counter.count + 1;
        comment.author = *ctx.accounts.author.key;
        comment.metadata_cid = metadata_cid;
        comment.parent_post = parent_post;
        comment.created_at = Clock::get()?.unix_timestamp;
        comment.deleted = false;

        ctx.accounts.comment_counter.count = comment.id;
        Ok(())
    }

    pub fn update_comment(
        ctx: Context<UpdateComment>,
        metadata_cid: Option<String>,
    ) -> Result<()> {
        let comment = &mut ctx.accounts.comment;
        require!(comment.author == *ctx.accounts.author.key, ErrorCode::Unauthorized);

        if let Some(cid) = metadata_cid {
            require!(cid.len() <= 200, ErrorCode::MetadataCidTooLong);
            comment.metadata_cid = cid;
        }
        Ok(())
    }

    pub fn delete_comment(ctx: Context<DeleteComment>) -> Result<()> {
        let comment = &mut ctx.accounts.comment;
        require!(comment.author == *ctx.accounts.author.key, ErrorCode::Unauthorized);
        comment.deleted = true;
        Ok(())
    }

    pub fn react_to_post(ctx: Context<ReactToPost>, reaction: i8) -> Result<()> {
        require!(
            reaction == 1 || reaction == -1 || reaction == 0,
            ErrorCode::InvalidReaction
        );

        let post = &mut ctx.accounts.post;
        let reaction_acc = &mut ctx.accounts.reaction;

        if reaction_acc.initialized == false {
            reaction_acc.post_id = post.id;
            reaction_acc.user = *ctx.accounts.user.key;
            reaction_acc.value = 0;
            reaction_acc.initialized = true;
        } else {
            require!(
                reaction_acc.post_id == post.id,
                ErrorCode::InvalidAccount
            );
            require!(
                reaction_acc.user == *ctx.accounts.user.key,
                ErrorCode::InvalidAccount
            );
        }

        match reaction {
            1 => {
                if reaction_acc.value == -1 {
                    post.dislikes = post.dislikes.saturating_sub(1);
                }
                if reaction_acc.value != 1 {
                    post.likes = post.likes.saturating_add(1);
                    reaction_acc.value = 1;
                }
            }
            -1 => {
                if reaction_acc.value == 1 {
                    post.likes = post.likes.saturating_sub(1);
                }
                if reaction_acc.value != -1 {
                    post.dislikes = post.dislikes.saturating_add(1);
                    reaction_acc.value = -1;
                }
            }
            0 => {
                if reaction_acc.value == 1 {
                    post.likes = post.likes.saturating_sub(1);
                } else if reaction_acc.value == -1 {
                    post.dislikes = post.dislikes.saturating_sub(1);
                }
                reaction_acc.value = 0;
            }
            _ => {}
        }

        Ok(())
    }
}

//
// Account Contexts
//

#[derive(Accounts)]
pub struct InitializeCounters<'info> {
    #[account(init_if_needed, payer = payer, space = 8 + 16, seeds = [b"post_counter"], bump)]
    pub post_counter: Account<'info, PostCounter>,
    #[account(init_if_needed, payer = payer, space = 8 + 16, seeds = [b"comment_counter"], bump)]
    pub comment_counter: Account<'info, CommentCounter>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(metadata_cid: String, ai_generated: bool)]
pub struct CreatePost<'info> {
    #[account(mut, seeds = [b"post_counter"], bump)]
    pub post_counter: Account<'info, PostCounter>,
    #[account(init, payer = author, space = Post::get_space(&metadata_cid), seeds = [b"post", &(post_counter.count + 1).to_le_bytes()], bump)]
    pub post: Account<'info, Post>,
    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePost<'info> {
    #[account(mut, has_one = author)]
    pub post: Account<'info, Post>,
    pub author: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeletePost<'info> {
    #[account(mut, has_one = author)]
    pub post: Account<'info, Post>,
    pub author: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(metadata_cid: String, parent_post: Option<u64>)]
pub struct CreateComment<'info> {
    #[account(mut, seeds = [b"comment_counter"], bump)]
    pub comment_counter: Account<'info, CommentCounter>,
    #[account(init, payer = author, space = Comment::get_space(&metadata_cid), seeds = [b"comment", &(comment_counter.count + 1).to_le_bytes()], bump)]
    pub comment: Account<'info, Comment>,
    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateComment<'info> {
    #[account(mut, has_one = author)]
    pub comment: Account<'info, Comment>,
    pub author: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeleteComment<'info> {
    #[account(mut, has_one = author)]
    pub comment: Account<'info, Comment>,
    pub author: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReactToPost<'info> {
    #[account(mut)]
    pub post: Account<'info, Post>,
    #[account(init_if_needed, payer = user, space = Reaction::get_space(), seeds = [b"reaction", &post.id.to_le_bytes(), user.key().as_ref()], bump)]
    pub reaction: Account<'info, Reaction>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

//
// Data Structures
//

#[account]
pub struct PostCounter {
    pub count: u64,
}

#[account]
pub struct CommentCounter {
    pub count: u64,
}

#[account]
pub struct Post {
    pub id: u64,
    pub author: Pubkey,
    pub metadata_cid: String,
    pub ai_generated: bool,
    pub likes: u64,
    pub dislikes: u64,
    pub created_at: i64,
    pub deleted: bool,
}

impl Post {
    pub fn get_space(metadata_cid: &String) -> usize {
        let mut size = 8;
        size += 8; // id
        size += 32; // author
        size += 4 + metadata_cid.len(); // cid string
        size += 1; // ai_generated
        size += 8 + 8; // likes + dislikes
        size += 8; // created_at
        size += 1; // deleted
        size
    }
}

#[account]
pub struct Comment {
    pub id: u64,
    pub author: Pubkey,
    pub metadata_cid: String,
    pub parent_post: Option<u64>,
    pub created_at: i64,
    pub deleted: bool,
}

impl Comment {
    pub fn get_space(metadata_cid: &String) -> usize {
        let mut size = 8;
        size += 8; // id
        size += 32; // author
        size += 4 + metadata_cid.len();
        size += 1 + 8; // Option<u64> parent_post
        size += 8; // created_at
        size += 1; // deleted
        size
    }
}

#[account]
pub struct Reaction {
    pub post_id: u64,
    pub user: Pubkey,
    pub value: i8,
    pub initialized: bool,
}

impl Reaction {
    pub fn get_space() -> usize {
        let mut size = 8;
        size += 8; // post_id
        size += 32; // user
        size += 1; // value
        size += 1; // initialized
        size
    }
}

//
// Errors
//
#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid reaction value")]
    InvalidReaction,
    #[msg("Invalid account passed")]
    InvalidAccount,
    #[msg("Metadata CID exceeds max length (200 chars)")]
    MetadataCidTooLong,
}
