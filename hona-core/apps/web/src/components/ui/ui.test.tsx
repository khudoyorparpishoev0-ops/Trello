// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Check, X } from 'lucide-react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  Button,
  Checkbox,
  CoreTile,
  CoreWordmark,
  CountBadge,
  Dot,
  Drawer,
  IconButton,
  LabelChip,
  Menu,
  Pill,
  ProgressBar,
  Toggle,
} from '.'

/** Скопированные примитивы (§23.3) работают без легаси-контекста. */
afterEach(cleanup)

describe('UI primitives', () => {
  it('Button: loading disables the button', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick} icon={Check}>
        Сохранить
      </Button>,
    )
    const button = screen.getByRole<HTMLButtonElement>('button', { name: 'Сохранить' })
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('IconButton exposes an accessible label', () => {
    render(<IconButton icon={X} label="Закрыть" />)
    expect(screen.getByRole('button', { name: 'Закрыть' })).toBeTruthy()
  })

  it('Checkbox and Toggle report state through ARIA and call onChange', () => {
    const onChange = vi.fn()
    render(
      <>
        <Checkbox checked={false} onChange={onChange} label="Пункт" />
        <Toggle checked onChange={onChange} label="Уведомления" />
      </>,
    )
    const checkbox = screen.getByRole('checkbox', { name: 'Пункт' })
    expect(checkbox.getAttribute('aria-checked')).toBe('false')
    expect(screen.getByRole('switch', { name: 'Уведомления' }).getAttribute('aria-checked')).toBe(
      'true',
    )
    fireEvent.click(checkbox)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('ProgressBar exposes value and range', () => {
    render(<ProgressBar value={3} max={4} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('3')
    expect(bar.getAttribute('aria-valuemax')).toBe('4')
  })

  it('Drawer closes on Escape and on the close button', () => {
    const onClose = vi.fn()
    render(
      <Drawer open onClose={onClose} title="Детали">
        body
      </Drawer>,
    )
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('Menu opens, runs an item and closes', () => {
    const onPick = vi.fn()
    render(
      <Menu
        trigger={({ toggle }) => (
          <button type="button" onClick={toggle}>
            Меню
          </button>
        )}
        items={[{ label: 'Архивировать', onClick: onPick }]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Меню' }))
    fireEvent.click(screen.getByRole('button', { name: 'Архивировать' }))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Архивировать' })).toBeNull()
  })

  it('badges and logo render without legacy data', () => {
    render(
      <>
        <CountBadge icon={Check} count={3} label="Комментарии" />
        <LabelChip name="срочно" color="#186B36" />
        <Pill tone="ok">ok</Pill>
        <Dot color="#33c561" />
        <CoreTile size={32} />
        <CoreWordmark />
      </>,
    )
    expect(screen.getByTitle('Комментарии: 3')).toBeTruthy()
    expect(screen.getByText('срочно')).toBeTruthy()
    expect(screen.getAllByText('CORE').length).toBeGreaterThan(0)
  })
})
