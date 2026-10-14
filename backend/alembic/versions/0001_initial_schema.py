"""initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-10-03 17:37:03.914028

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('roles',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=50), nullable=False),
    sa.Column('description', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_roles'))
    )
    op.create_index(op.f('ix_roles_name'), 'roles', ['name'], unique=True)
    op.create_table('users',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('full_name', sa.String(length=150), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('role_id', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default=sa.text('1'), nullable=False),
    sa.Column('last_login_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['role_id'], ['roles.id'], name=op.f('fk_users_role_id_roles'), ondelete='RESTRICT'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_users'))
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_role_id'), 'users', ['role_id'], unique=False)
    op.create_table('activity_logs',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('action', sa.String(length=50), nullable=False),
    sa.Column('entity_type', sa.String(length=50), nullable=True),
    sa.Column('entity_id', sa.Integer(), nullable=True),
    sa.Column('description', sa.String(length=500), nullable=True),
    sa.Column('old_values', sa.JSON(), nullable=True),
    sa.Column('new_values', sa.JSON(), nullable=True),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], name=op.f('fk_activity_logs_user_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_activity_logs'))
    )
    op.create_index(op.f('ix_activity_logs_action'), 'activity_logs', ['action'], unique=False)
    op.create_index(op.f('ix_activity_logs_created_at'), 'activity_logs', ['created_at'], unique=False)
    op.create_index('ix_activity_logs_entity_type_entity_id', 'activity_logs', ['entity_type', 'entity_id'], unique=False)
    op.create_index(op.f('ix_activity_logs_user_id'), 'activity_logs', ['user_id'], unique=False)
    op.create_table('forms',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('slug', sa.String(length=64), nullable=False),
    sa.Column('owner_id', sa.Integer(), nullable=False),
    sa.Column('is_active', sa.Boolean(), server_default=sa.text('1'), nullable=False),
    sa.Column('is_public', sa.Boolean(), server_default=sa.text('0'), nullable=False),
    sa.Column('allow_response_edit', sa.Boolean(), server_default=sa.text('0'), nullable=False),
    sa.Column('allow_multiple_submissions', sa.Boolean(), server_default=sa.text('1'), nullable=False),
    sa.Column('submit_message', sa.String(length=500), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['owner_id'], ['users.id'], name=op.f('fk_forms_owner_id_users'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_forms'))
    )
    op.create_index(op.f('ix_forms_owner_id'), 'forms', ['owner_id'], unique=False)
    op.create_index(op.f('ix_forms_slug'), 'forms', ['slug'], unique=True)
    op.create_table('form_fields',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('form_id', sa.Integer(), nullable=False),
    sa.Column('field_key', sa.String(length=100), nullable=False),
    sa.Column('label', sa.String(length=255), nullable=False),
    sa.Column('field_type', sa.String(length=20), nullable=False),
    sa.Column('placeholder', sa.String(length=255), nullable=True),
    sa.Column('help_text', sa.String(length=500), nullable=True),
    sa.Column('is_required', sa.Boolean(), server_default=sa.text('0'), nullable=False),
    sa.Column('order_index', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.Column('config', sa.JSON(), nullable=True),
    sa.Column('visibility_rules', sa.JSON(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['form_id'], ['forms.id'], name=op.f('fk_form_fields_form_id_forms'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_form_fields')),
    sa.UniqueConstraint('form_id', 'field_key', name='uq_form_fields_form_id_field_key')
    )
    op.create_index(op.f('ix_form_fields_form_id'), 'form_fields', ['form_id'], unique=False)
    op.create_table('form_responses',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('form_id', sa.Integer(), nullable=False),
    sa.Column('submitted_by', sa.Integer(), nullable=True),
    sa.Column('updated_by', sa.Integer(), nullable=True),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('user_agent', sa.String(length=500), nullable=True),
    sa.Column('version', sa.Integer(), server_default=sa.text('1'), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['form_id'], ['forms.id'], name=op.f('fk_form_responses_form_id_forms'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['submitted_by'], ['users.id'], name=op.f('fk_form_responses_submitted_by_users'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_form_responses_updated_by_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_form_responses'))
    )
    op.create_index('ix_form_responses_form_id_created_at', 'form_responses', ['form_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_form_responses_submitted_by'), 'form_responses', ['submitted_by'], unique=False)
    op.create_table('field_options',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('field_id', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(length=255), nullable=False),
    sa.Column('value', sa.String(length=255), nullable=False),
    sa.Column('order_index', sa.Integer(), server_default=sa.text('0'), nullable=False),
    sa.ForeignKeyConstraint(['field_id'], ['form_fields.id'], name=op.f('fk_field_options_field_id_form_fields'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_field_options'))
    )
    op.create_index(op.f('ix_field_options_field_id'), 'field_options', ['field_id'], unique=False)
    op.create_table('response_details',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('response_id', sa.Integer(), nullable=False),
    sa.Column('field_id', sa.Integer(), nullable=True),
    sa.Column('field_key', sa.String(length=100), nullable=False),
    sa.Column('field_label', sa.String(length=255), nullable=False),
    sa.Column('field_type', sa.String(length=20), nullable=False),
    sa.Column('value', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
    sa.ForeignKeyConstraint(['field_id'], ['form_fields.id'], name=op.f('fk_response_details_field_id_form_fields'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['response_id'], ['form_responses.id'], name=op.f('fk_response_details_response_id_form_responses'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_response_details'))
    )
    op.create_index(op.f('ix_response_details_field_id'), 'response_details', ['field_id'], unique=False)
    op.create_index('ix_response_details_response_id_field_key', 'response_details', ['response_id', 'field_key'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_response_details_response_id_field_key', table_name='response_details')
    op.drop_index(op.f('ix_response_details_field_id'), table_name='response_details')
    op.drop_table('response_details')
    op.drop_index(op.f('ix_field_options_field_id'), table_name='field_options')
    op.drop_table('field_options')
    op.drop_index(op.f('ix_form_responses_submitted_by'), table_name='form_responses')
    op.drop_index('ix_form_responses_form_id_created_at', table_name='form_responses')
    op.drop_table('form_responses')
    op.drop_index(op.f('ix_form_fields_form_id'), table_name='form_fields')
    op.drop_table('form_fields')
    op.drop_index(op.f('ix_forms_slug'), table_name='forms')
    op.drop_index(op.f('ix_forms_owner_id'), table_name='forms')
    op.drop_table('forms')
    op.drop_index(op.f('ix_activity_logs_user_id'), table_name='activity_logs')
    op.drop_index('ix_activity_logs_entity_type_entity_id', table_name='activity_logs')
    op.drop_index(op.f('ix_activity_logs_created_at'), table_name='activity_logs')
    op.drop_index(op.f('ix_activity_logs_action'), table_name='activity_logs')
    op.drop_table('activity_logs')
    op.drop_index(op.f('ix_users_role_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_roles_name'), table_name='roles')
    op.drop_table('roles')
